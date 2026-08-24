import { z } from "zod";
import { GithubClient, OwnerRepo } from "../lib/github.js";
import type { RegistrableServer } from "./scanners.js";

const RepoInput = { repo: OwnerRepo.describe("Repository to scan, as `owner/repo`") };

const COMMUNITY_FILES = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/FUNDING.yml",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
] as const;

interface NpmLatest {
  version?: string;
  deprecated?: string;
}

async function npmLatest(pkg: string): Promise<NpmLatest | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as NpmLatest;
  } catch {
    return null;
  }
}

function majorOf(version: string): number | null {
  const m = /^v?(\d+)\./.exec(version.trim());
  return m ? Number(m[1]) : null;
}

function text(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

/** Wrap a handler so tool errors come back as MCP content, not HTTP 500s. */
function safe(handler: (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>) {
  return async (args: any) => {
    try {
      return await handler(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return text({ error: message });
    }
  };
}

export function registerAdvancedTools(server: RegistrableServer, gh: GithubClient): void {
  server.registerTool(
    "audit_dependencies",
    {
      title: "Audit dependencies",
      description:
        "Reads package.json from the repo default branch and compares each dependency against the npm registry: flags deprecated packages and dependencies that are one or more majors behind latest. Read-only.",
      inputSchema: {
        ...RepoInput,
        max_packages: z.number().int().positive().max(100).default(30).describe("Cap on deps checked (keeps runtime bounded)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo, max_packages }) => {
      const raw = await gh.getRawFile(repo, "package.json");
      if (!raw) return text({ error: "No package.json on the default branch" });
      let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      try {
        manifest = JSON.parse(raw.text);
      } catch {
        return text({ error: "package.json is not valid JSON" });
      }
      const declared = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).slice(0, max_packages);
      const findings = await Promise.all(
        declared.map(async ([name, range]) => {
          const info = await npmLatest(name);
          if (!info?.version) return { name, range, status: "registry-unreachable" as const };
          if (info.deprecated) {
            return { name, range, status: "deprecated" as const, latest: info.version, note: info.deprecated.slice(0, 140) };
          }
          const wantMajor = majorOf(info.version);
          const gotMajor = majorOf(range.replace(/^[\^~>=<\s]+/, ""));
          if (wantMajor !== null && gotMajor !== null && wantMajor > gotMajor) {
            return { name, range, status: "major-behind" as const, installed_major: gotMajor, latest: info.version };
          }
          return { name, range, status: "ok" as const };
        }),
      );
      const problems = findings.filter((f) => f.status !== "ok");
      return text({
        checked: findings.length,
        deprecated: problems.filter((p) => p.status === "deprecated"),
        majors_behind: problems.filter((p) => p.status === "major-behind"),
        unreachable: problems.filter((p) => p.status === "registry-unreachable"),
        healthy: findings.length - problems.length,
      });
    }),
  );

  server.registerTool(
    "check_community_health",
    {
      title: "Community health check",
      description:
        "Checks for the standard community files (LICENSE, CONTRIBUTING, Code of Conduct, SECURITY policy, issue/PR templates, funding) and returns a scored report with what is missing. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo }) => {
      const results = await Promise.all(
        COMMUNITY_FILES.map(async (path) => ({ path, present: await gh.hasCommunityFile(repo, path) })),
      );
      const present = results.filter((r) => r.present);
      const missing = results.filter((r) => !r.present).map((r) => r.path);
      const essential = ["README.md", "LICENSE", "CONTRIBUTING.md"];
      const essentialsMissing = missing.filter((m) => essential.includes(m));
      return text({
        score: `${present.length}/${COMMUNITY_FILES.length}`,
        grade: essentialsMissing.length === 0 ? "good" : essentialsMissing.length <= 2 ? "needs-work" : "poor",
        missing,
        essentials_missing: essentialsMissing,
        present: present.map((p) => p.path),
      });
    }),
  );

  server.registerTool(
    "classify_ci_failures",
    {
      title: "Classify CI failures",
      description:
        "Inspects failing workflow runs' jobs and steps, classifying each failure as likely-flaky or likely-broken based on whether any step succeeded before failing. Returns evidence per run. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo }) => {
      const runs = await gh.listWorkflowRuns(repo, 20);
      const failed = runs.workflow_runs.filter((r) => r.conclusion && r.conclusion !== "success").slice(0, 5);
      const classified = await Promise.all(
        failed.map(async (run) => {
          const jobs = await gh.getWorkflowJobs(repo, run.id);
          const brokenSteps = jobs.jobs.flatMap((job) =>
            (job.steps ?? [])
              .filter((s) => s.conclusion && !["success", "skipped", null].includes(s.conclusion))
              .map((s) => ({ job: job.name, step: s.name, conclusion: s.conclusion })),
          );
          // A run whose earlier steps all passed and died at exactly one late step
          // smells flaky; multiple distinct failing steps across jobs smells broken.
          const distinctFailures = new Set(brokenSteps.map((b) => b.step)).size;
          return {
            run: run.name,
            conclusion: run.conclusion,
            url: run.html_url,
            verdict: distinctFailures <= 1 ? "likely-flaky" : "likely-broken",
            evidence: brokenSteps.slice(0, 10),
            distinct_failing_steps: distinctFailures,
          };
        }),
      );
      return text({ failing_runs_examined: classified.length, classifications: classified });
    }),
  );

  server.registerTool(
    "search_similar_issues",
    {
      title: "Search for similar issues",
      description:
        "GitHub issue search against one repository — used to avoid filing duplicate issues. Read-only.",
      inputSchema: {
        ...RepoInput,
        query: z.string().min(3).describe("Search terms, e.g. `dead link README`"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo, query }) => {
      const res = await gh.searchIssues(repo, query);
      return text({
        total: res.total_count,
        matches: res.items.map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })),
      });
    }),
  );
}
