import { describe, it, expect, vi } from "vitest";
import { GithubClient, OwnerRepo } from "../src/lib/github.js";
import { isRealIssue } from "../src/tools/scanners.js";

describe("OwnerRepo schema", () => {
  it("accepts owner/repo", () => {
    expect(OwnerRepo.safeParse("aniruddhaadak80/repomedic").success).toBe(true);
  });
  it("rejects a bare repo name", () => {
    expect(OwnerRepo.safeParse("repomedic").success).toBe(false);
  });
  it("rejects URLs", () => {
    expect(OwnerRepo.safeParse("https://github.com/a/b").success).toBe(false);
  });
});

describe("isRealIssue", () => {
  it("keeps plain issues", () => {
    expect(isRealIssue({})).toBe(true);
  });
  it("filters out pull requests", () => {
    expect(isRealIssue({ pull_request: {} })).toBe(false);
  });
});

describe("GithubClient write guard", () => {
  const make = (allowed: string) =>
    new GithubClient("test-token", allowed.split(","));

  it("refuses all writes when the allow-list is empty", () => {
    const gh = make("");
    expect(() => gh.assertWriteAllowed("a/b")).toThrow(/all writes are disabled/i);
  });

  it("allows writes to listed repos", () => {
    const gh = make("a/b");
    expect(() => gh.assertWriteAllowed("A/B")).not.toThrow();
  });

  it("refuses writes outside the allow-list", () => {
    const gh = make("a/b");
    expect(() => gh.assertWriteAllowed("c/d")).toThrow(/write refused/i);
  });
});


describe("GithubClient.isRetryable", () => {
  it("treats rate limits and 5xx as transient", () => {
    expect(GithubClient.isRetryable(429)).toBe(true);
    expect(GithubClient.isRetryable(502)).toBe(true);
    expect(GithubClient.isRetryable(403)).toBe(true);
  });
  it("never retries client errors that are our fault", () => {
    expect(GithubClient.isRetryable(401)).toBe(false);
    expect(GithubClient.isRetryable(404)).toBe(false);
    expect(GithubClient.isRetryable(422)).toBe(false);
  });
});

describe("GithubClient.readme", () => {
  it("returns null on 404 without throwing", async () => {
    const gh = new GithubClient("test-token", []);
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );
    await expect(gh.getDefaultBranchReadme("a/b")).resolves.toBeNull();
  });
});
