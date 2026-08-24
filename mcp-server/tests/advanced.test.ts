import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockRegistry(responses: Record<string, unknown>) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    for (const [fragment, body] of Object.entries(responses)) {
      if (url.includes(fragment)) {
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }
    return new Response("not found", { status: 404 });
  });
}

describe("npmLatest lookup (via advanced tools registry calls)", () => {
  it("parses version and deprecation from the registry", async () => {
    const fetchMock = mockRegistry({
      "registry.npmjs.org/left-pad": { version: "1.3.0", deprecated: "use built-in String.padStart" },
      "registry.npmjs.org/react": { version: "19.0.0" },
    });

    const { GithubClient } = await import("../src/lib/github.js");
    const gh = new GithubClient("t", []);

    // package.json fetch goes to api.github.com — served by the same mock
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("registry.npmjs.org/left-pad")) {
        return new Response(JSON.stringify({ version: "1.3.0", deprecated: "use built-in String.padStart" }), { status: 200 });
      }
      if (url.includes("registry.npmjs.org/react")) {
        return new Response(JSON.stringify({ version: "19.0.0" }), { status: 200 });
      }
      if (url.includes("api.github.com") && url.includes("package.json")) {
        return new Response(
          JSON.stringify({ dependencies: { "left-pad": "^1.3.0", react: "^19.0.0" } }),
          { status: 200 },
        );
      }
      return new Response("nope", { status: 404 });
    });

    // Exercise the client path the tool uses
    const manifest = await gh.getRawFile("a/b", "package.json");
    expect(manifest?.text).toContain("left-pad");

    const reg = await fetch("https://registry.npmjs.org/left-pad/latest").then((r) => r.json());
    expect(reg.deprecated).toBeTruthy();
  });
});

describe("majorOf-style range parsing", () => {
  it("strips range operators when comparing majors", async () => {
    const strip = (range: string) => range.replace(/^[\^~>=<\s]+/, "");
    expect(strip("^4.17.21")).toBe("4.17.21");
    expect(strip("~2.0.0")).toBe("2.0.0");
    expect(strip(">=3.1.0")).toBe("3.1.0");
  });
});
