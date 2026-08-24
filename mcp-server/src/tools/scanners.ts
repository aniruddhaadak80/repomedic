import { z } from "zod";
import { GithubClient, OwnerRepo } from "../lib/github.js";

export const STALE_DAYS_DEFAULT = 30;

const RepoInput = { repo: OwnerRepo.describe("Repository to scan, as `owner/repo`") };

type ToolConfig = {
  title?: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  annotations?: Record<string, unknown>;
};

type ToolHandler = (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

export type RegistrableServer = {
  registerTool: (name: string, config: ToolConfig, handler: ToolHandler) => unknown;
};

function daysBetween(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

export function isRealIssue(issue: { pull_request?: unknown }): boolean {
  return !issue.pull_request; // the issues API also returns PRs — filter them out
}

function text(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

/** Read-only scanners run autonomously — no approval gate needed. */
export function registerScanners(server: RegistrableServer, gh: GithubClient): void {
  server.registerTool(
    "repo_health_check",
    {
      title: "Repo health check",
      description:
        "Overall repository health snapshot: open issue count, stale issues, latest CI conclusions on the default branch, and README presence. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ repo }) => {
      const [details, issues, runs, readme] = await Promise.all([
        gh.getRepo(repo),
        gh.listOpenIssues(repo),
        gh.listWorkflowRuns(repo),
        gh.getDefaultBranchReadme(repo),
      ]);
      const realIssues = issues.filter(isRealIssue);
      const stale = realIssues.filter((i) => daysBetween(i.updated_at) >= STALE_DAYS_DEFAULT);
      const defaultRuns = runs.workflow_runs.filter(
        (r) => r.head_branch === details.default_branch,
      );
      const failing = defaultRuns.filter((r) => r.conclusion && r.conclusion !== "success");
      return text({
        repo: details.full_name,
        default_branch: details.default_branch,
        open_issues: realIssues.length,
        [`stale_issues_open_${STALE_DAYS_DEFAULT}d_plus`]: stale.length,
        ci_on_default_branch: defaultRuns
          .slice(0, 5)
          .map((r) => ({ name: r.name, conclusion: r.conclusion, url: r.html_url })),
        failing_runs: failing.length,
        readme_present: readme !== null,
        last_push: details.pushed_at,
      });
    },
  );

  server.registerTool(
    "list_stale_issues",
    {
      title: "List stale issues",
      description: `Open issues with no activity for at least N days (default ${STALE_DAYS_DEFAULT}). PRs are excluded. Read-only.`,
      inputSchema: {
        ...RepoInput,
        min_stale_days: z.number().int().positive().default(STALE_DAYS_DEFAULT),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ repo, min_stale_days }) => {
      const issues = (await gh.listOpenIssues(repo)).filter(isRealIssue);
      const stale = issues
        .map((i) => ({ number: i.number, title: i.title, url: i.html_url, comments: i.comments, days_stale: daysBetween(i.updated_at) }))
        .filter((i) => i.days_stale >= min_stale_days)
        .sort((a, b) => b.days_stale - a.days_stale);
      return text(stale);
    },
  );

  server.registerTool(
    "check_readme_links",
    {
      title: "Check README links",
      description:
        "Fetch the README, extract every http(s) link, verify each responds. Returns dead links. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ repo }) => {
      const readme = await gh.getDefaultBranchReadme(repo);
      if (!readme) return text({ error: "No README found" });
      const links = [...new Set(readme.text.match(/https?:\/\/[^\s)\]"'<>]+/g) ?? [])];
      const results = await Promise.all(
        links.map(async (url) => ({ url, ...(await gh.urlIsAlive(url)) })),
      );
      const dead = results.filter((r) => !r.ok);
      return text({ checked: links.length, dead_links: dead, all_ok: dead.length === 0 });
    },
  );

  server.registerTool(
    "get_ci_status",
    {
      title: "Get CI status",
      description: "Latest GitHub Actions workflow runs for the repository. Read-only.",
      inputSchema: RepoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ repo }) => {
      const runs = await gh.listWorkflowRuns(repo);
      return text(
        runs.workflow_runs.map((r) => ({
          name: r.name,
          branch: r.head_branch,
          status: r.status,
          conclusion: r.conclusion,
          created_at: r.created_at,
          url: r.html_url,
        })),
      );
    },
  );
}
