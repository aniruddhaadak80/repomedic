import { z } from "zod";
import { GithubClient, OwnerRepo } from "../lib/github.js";
import type { RegistrableServer } from "./scanners.js";

const RepoInput = { repo: OwnerRepo.describe("Repository to scan, as `owner/repo`") };

function text(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

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

// ---- pure ranking logic (exported for tests) ----

export interface Finding {
  area: string;
  severity: "high" | "medium" | "low";
  summary: string;
  evidence?: string;
}

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

/** Rank findings the way a senior maintainer would triage: breakage first, hygiene last. */
export function rankFindings(findings: Finding[]): Array<Finding & { rank: number }> {
  return findings
    .map((f) => ({ ...f }))
    .sort(
      (a, b) =>
        SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
        a.area.localeCompare(b.area),
    )
    .map((f, i) => ({ ...f, rank: i + 1 }));
}

export function registerInsightTools(server: RegistrableServer, gh: GithubClient): void {
  server.registerTool(
    "bus_factor",
    {
      title: "Bus factor analysis",
      description:
        "Contribution concentration: how much of recent commit activity depends on the top contributor. Low contributor diversity is a maintenance risk. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo }) => {
      const contributors = (await gh.listContributors(repo)) as Array<{
        login: string;
        contributions: number;
      }>;
      if (!contributors.length) return text({ error: "No contributor data available" });
      const total = contributors.reduce((s, c) => s + c.contributions, 0);
      const top = contributors[0];
      const topShare = top.contributions / total;
      // Bus factor ≈ number of people needed to reach 50% of all contributions.
      let acc = 0;
      let busFactor = 0;
      for (const c of contributors) {
        acc += c.contributions / total;
        busFactor += 1;
        if (acc >= 0.5) break;
      }
      return text({
        contributors_considered: contributors.length,
        total_contributions: total,
        bus_factor_50pct: busFactor,
        verdict:
          busFactor <= 1 ? "critical" : busFactor === 2 ? "fragile" : busFactor <= 4 ? "okay" : "healthy",
        top_contributor: { login: top.login, share: `${Math.round(topShare * 100)}%` },
      });
    }),
  );

  server.registerTool(
    "release_health",
    {
      title: "Release health",
      description:
        "How far the default branch has drifted since the latest release: commits ahead, sampled messages, and release age. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo }) => {
      const release = await gh.getLatestRelease(repo);
      if (!release) {
        return text({ has_releases: false, note: "Repository has never published a release." });
      }
      const ageDays = Math.floor(
        (Date.now() - new Date(release.published_at).getTime()) / 86_400_000,
      );
      const compare = await gh.compareWithHead(repo, release.tag_name);
      return text({
        has_releases: true,
        latest: { tag: release.tag_name, published_at: release.published_at, url: release.html_url },
        release_age_days: ageDays,
        commits_since_release: compare?.total_commits ?? null,
        sample_of_unreleased: (compare?.commits ?? [])
          .slice(0, 5)
          .map((c) => c.message.split("\n")[0]),
        drift_verdict:
          !compare ? "unknown" : compare.total_commits >= 25 ? "high-drift" : compare.total_commits >= 8 ? "normal-cadence" : "quiet",
      });
    }),
  );

  server.registerTool(
    "triage_priorities",
    {
      title: "Triage priorities",
      description:
        "The flagship composite: runs health, CI, community and staleness scans in one pass, then returns a severity-ranked action list — what a senior maintainer would fix first. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ repo }) => {
      const [details, issues, runs, readme, communityFiles] = await Promise.all([
        gh.getRepo(repo),
        gh.listOpenIssues(repo),
        gh.listWorkflowRuns(repo),
        gh.getDefaultBranchReadme(repo),
        Promise.all(
          ["LICENSE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md"].map(async (p) => ({
            path: p,
            present: await gh.hasCommunityFile(repo, p),
          })),
        ),
      ]);

      const realIssues = issues.filter((i) => !i.pull_request);
      const stale = realIssues.filter(
        (i) => Date.now() - new Date(i.updated_at).getTime() > 30 * 86_400_000 && i.comments === 0,
      );
      const defaultRuns = runs.workflow_runs.filter((r) => r.head_branch === details.default_branch);
      const failingRuns = defaultRuns.filter((r) => r.conclusion && r.conclusion !== "success");
      const missingEssentials = communityFiles.filter((f) => !f.present).map((f) => f.path);

      const findings: Finding[] = [];
      if (failingRuns.length > 0) {
        findings.push({
          area: "ci",
          severity: "high",
          summary: `${failingRuns.length} failing workflow run(s) on ${details.default_branch}`,
          evidence: failingRuns[0]?.html_url,
        });
      }
      if (!readme) {
        findings.push({ area: "docs", severity: "medium", summary: "README missing on default branch" });
      }
      if (missingEssentials.length > 0) {
        findings.push({
          area: "community",
          severity: missingEssentials.includes("LICENSE") ? "medium" : "low",
          summary: `Missing community files: ${missingEssentials.join(", ")}`,
        });
      }
      if (stale.length > 0) {
        findings.push({
          area: "issues",
          severity: stale.length >= 5 ? "medium" : "low",
          summary: `${stale.length} issue(s) untouched for 30+ days with no comments`,
          evidence: stale[0]?.html_url,
        });
      }
      const daysIdle = Math.floor(
        (Date.now() - new Date(details.pushed_at).getTime()) / 86_400_000,
      );
      if (daysIdle > 180) {
        findings.push({
          area: "activity",
          severity: "low",
          summary: `Last push was ${daysIdle} days ago`,
        });
      }

      const ranked = rankFindings(findings);
      return text({
        repo: details.full_name,
        overall: ranked.length === 0 ? "clean 🎉" : `${ranked.length} finding(s)`,
        next_actions: ranked.map((f) => ({
          rank: f.rank,
          do: f.summary,
          area: f.area,
          severity: f.severity,
          ...(f.evidence ? { evidence: f.evidence } : {}),
        })),
      });
    }),
  );
}
