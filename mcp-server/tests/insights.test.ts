import { describe, it, expect, vi } from "vitest";
import { rankFindings } from "../src/tools/insights.js";

describe("rankFindings", () => {
  it("orders high before medium before low", () => {
    const ranked = rankFindings([
      { area: "issues", severity: "low", summary: "stale" },
      { area: "ci", severity: "high", summary: "failing build" },
      { area: "community", severity: "medium", summary: "no CoC" },
    ]);
    expect(ranked.map((r) => r.severity)).toEqual(["high", "medium", "low"]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[2].rank).toBe(3);
  });

  it("breaks severity ties alphabetically by area", () => {
    const ranked = rankFindings([
      { area: "docs", severity: "medium", summary: "a" },
      { area: "ci", severity: "medium", summary: "b" },
    ]);
    expect(ranked.map((r) => r.area)).toEqual(["ci", "docs"]);
  });

  it("returns an empty list unchanged (clean repo)", () => {
    expect(rankFindings([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [{ area: "z", severity: "high" as const, summary: "x" }];
    const copy = [...input];
    rankFindings(input);
    expect(input).toEqual(copy);
  });
});

describe("insight tools against a mocked client", () => {
  function captureServer() {
    const tools = new Map<string, { handler: (args: any) => Promise<any> }>();
    return {
      server: {
        registerTool: (_n: string, _c: any, h: (args: any) => Promise<any>) => tools.set(_n, { handler: h }),
      },
      call: async <T = any>(name: string, args: any): Promise<T> => {
        const entry = tools.get(name);
        if (!entry) throw new Error(`not registered: ${name}`);
        const result = await entry.handler(args);
        return JSON.parse(result.content[0].text) as T;
      },
    };
  }

  async function setup(overrides: Record<string, unknown> = {}) {
    const { GithubClient } = await import("../src/lib/github.js");
    const gh = Object.assign(Object.create(Object.getPrototypeOf(new GithubClient("t", []))), {
      listContributors: vi.fn().mockResolvedValue([
        { login: "alice", contributions: 90 },
        { login: "bob", contributions: 8 },
        { login: "carol", contributions: 2 },
      ]),
      getLatestRelease: vi.fn().mockResolvedValue({
        tag_name: "v1.0.0",
        name: "first",
        published_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
        html_url: "rel",
      }),
      compareWithHead: vi.fn().mockResolvedValue({
        total_commits: 30,
        commits: Array.from({ length: 30 }, (_, i) => ({ message: `c${i}` })),
      }),
      ...overrides,
    }) as InstanceType<typeof GithubClient>;

    const { server, call } = captureServer();
    const { registerInsightTools } = await import("../src/tools/insights.js");
    registerInsightTools(server as never, gh);
    return { call };
  }

  it("bus_factor computes concentration and verdict", async () => {
    const { call } = await setup();
    const res = await call<any>("bus_factor", { repo: "a/b" });
    // alice alone is 90% ≥ 50% → bus factor 1 → critical
    expect(res.bus_factor_50pct).toBe(1);
    expect(res.verdict).toBe("critical");
    expect(res.top_contributor.share).toBe("90%");
  });

  it("release_health flags high drift when many commits since release", async () => {
    const { call } = await setup();
    const res = await call<any>("release_health", { repo: "a/b" });
    expect(res.has_releases).toBe(true);
    expect(res.commits_since_release).toBe(30);
    expect(res.drift_verdict).toBe("high-drift");
  });

  it("release_health handles repos with no releases", async () => {
    const { call } = await setup({ getLatestRelease: vi.fn().mockResolvedValue(null) });
    const res = await call<any>("release_health", { repo: "a/b" });
    expect(res.has_releases).toBe(false);
  });
});
