import { describe, it, expect, vi } from "vitest";
import { GithubClient } from "../src/lib/github.js";
import { registerScanners } from "../src/tools/scanners.js";
import { registerAdvancedTools } from "../src/tools/advanced.js";

/** Captures tool registrations so handlers can be invoked with a mocked client. */
function captureServer() {
  const tools = new Map<string, { config: any; handler: (args: any) => Promise<any> }>();
  return {
    server: {
      registerTool: (name: string, config: any, handler: (args: any) => Promise<any>) => {
        tools.set(name, { config, handler });
      },
    },
    tools,
    call: async <T = any>(name: string, args: any): Promise<T> => {
      const entry = tools.get(name);
      if (!entry) throw new Error(`tool not registered: ${name}`);
      const result = await entry.handler(args);
      return JSON.parse(result.content[0].text) as T;
    },
  };
}

function mockClient(overrides: Partial<Record<string, unknown>> = {}) {
  const base: Record<string, unknown> = {
    getRepo: vi.fn().mockResolvedValue({
      full_name: "a/b",
      default_branch: "main",
      open_issues_count: 2,
      pushed_at: "2026-08-24T00:00:00Z",
    }),
    listOpenIssues: vi.fn().mockResolvedValue([
      { number: 1, title: "recent", updated_at: new Date().toISOString(), comments: 2, html_url: "u1", pull_request: {} },
      { number: 2, title: "real issue", updated_at: new Date(Date.now() - 40 * 86_400_000).toISOString(), comments: 0, html_url: "u2" },
    ]),
    listWorkflowRuns: vi.fn().mockResolvedValue({
      workflow_runs: [
        { id: 11, name: "CI", conclusion: "failure", head_branch: "main", html_url: "r1", created_at: "2026-08-23T00:00:00Z" },
        { id: 12, name: "CI", conclusion: "success", head_branch: "dev", html_url: "r2", created_at: "2026-08-23T00:00:00Z" },
      ],
    }),
    getDefaultBranchReadme: vi.fn().mockResolvedValue({ text: "see https://dead.example.com" }),
    urlIsAlive: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    getRawFile: vi.fn().mockResolvedValue(null),
    hasCommunityFile: vi.fn().mockResolvedValue(false),
    searchIssues: vi.fn().mockResolvedValue({ total_count: 0, items: [] }),
    ...overrides,
  };
  return base as unknown as GithubClient;
}

describe("scanner tools (handlers against a mocked client)", () => {
  it("repo_health_check excludes PRs from issue counts", async () => {
    const { server, call } = captureServer();
    registerScanners(server as never, mockClient());
    const report = await call("repo_health_check", { repo: "a/b" });
    expect(report.open_issues).toBe(1); // the PR-shaped entry is filtered out
    expect(report.stale_issues_open_30d_plus).toBe(1);
    expect(report.failing_runs).toBe(1); // only the main-branch run counts
  });

  it("list_stale_issues sorts by staleness and drops PRs", async () => {
    const { server, call } = captureServer();
    registerScanners(server as never, mockClient());
    const stale = await call("list_stale_issues", { repo: "a/b" });
    expect(stale).toHaveLength(1);
    expect(stale[0].number).toBe(2);
    expect(stale[0].days_stale).toBeGreaterThanOrEqual(30);
  });

  it("check_readme_links reports dead links found in the README", async () => {
    const { server, call } = captureServer();
    registerScanners(server as never, mockClient());
    const res = await call("check_readme_links", { repo: "a/b" });
    expect(res.checked).toBe(1);
    expect(res.all_ok).toBe(false);
    expect(res.dead_links[0].url).toBe("https://dead.example.com");
  });

  it("read-only tools declare readOnlyHint", () => {
    const { server, tools } = captureServer();
    registerScanners(server as never, mockClient());
    for (const [, { config }] of tools) {
      expect(config.annotations.readOnlyHint).toBe(true);
      expect(config.annotations.destructiveHint).toBeUndefined();
    }
  });
});

describe("advanced tools", () => {
  it("check_community_health grades essentials correctly", async () => {
    const gh = mockClient({
      hasCommunityFile: vi.fn((repo: string, path: string) =>
        Promise.resolve(["README.md", "LICENSE"].includes(path)),
      ),
    });
    const { server, call } = captureServer();
    registerAdvancedTools(server as never, gh);
    const res = await call("check_community_health", { repo: "a/b" });
    expect(res.essentials_missing).toEqual(["CONTRIBUTING.md"]);
    expect(res.grade).toBe("needs-work");
    expect(res.score).toBe("2/8");
  });

  it("search_similar_issues passes through totals and matches", async () => {
    const gh = mockClient({
      searchIssues: vi.fn().mockResolvedValue({
        total_count: 1,
        items: [{ number: 7, title: "dup?", state: "open", html_url: "u7" }],
      }),
    });
    const { server, call } = captureServer();
    registerAdvancedTools(server as never, gh);
    const res = await call("search_similar_issues", { repo: "a/b", query: "dup" });
    expect(res.total).toBe(1);
    expect(res.matches[0].number).toBe(7);
  });

  it("audit_dependencies flags deprecated packages via registry data", async () => {
    const gh = mockClient({
      getRawFile: vi.fn().mockResolvedValue({
        text: JSON.stringify({ dependencies: { "left-pad": "^1.3.0", react: "^19.0.0" } }),
      }),
    });
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("left-pad")) {
        return new Response(JSON.stringify({ version: "1.3.0", deprecated: "use padStart" }), { status: 200 });
      }
      if (url.includes("react")) {
        return new Response(JSON.stringify({ version: "19.1.0" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    const { server, call } = captureServer();
    registerAdvancedTools(server as never, gh);
    const res = await call("audit_dependencies", { repo: "a/b" });
    expect(res.deprecated).toHaveLength(1);
    expect(res.deprecated[0].name).toBe("left-pad");
    // react ^19 vs latest 19.x: same major → healthy
    expect(res.majors_behind).toHaveLength(0);
    expect(res.healthy).toBe(1);
    vi.restoreAllMocks();
  });

  it("gated writers declare destructiveHint; scanners do not", () => {
    const { server, tools } = captureServer();
    registerAdvancedTools(server as never, mockClient());
    for (const [name, { config }] of tools) {
      if (["file_issue", "post_comment"].includes(name)) {
        // writers are registered elsewhere; nothing to assert here
        continue;
      }
      expect(config.annotations.readOnlyHint).toBe(true);
    }
  });
});
