import { z } from "zod";

const GITHUB_API = "https://api.github.com";

export const OwnerRepo = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Expected `owner/repo`");
export type OwnerRepo = z.infer<typeof OwnerRepo>;

export class GithubClient {
  private token: string;
  private allowedRepos: Set<string>;

  constructor(token: string, allowedRepos: string[]) {
    if (!token) throw new Error("GITHUB_TOKEN is not set");
    this.token = token;
    this.allowedRepos = new Set(allowedRepos.map((r) => r.trim().toLowerCase()).filter(Boolean));
  }

  /** Writes are refused for repos outside the operator's allow-list — defense in depth on top of the approval gate. */
  assertWriteAllowed(repo: string): void {
    if (this.allowedRepos.size === 0) {
      throw new Error("REPOMEDIC_ALLOWED_REPOS is empty — all writes are disabled.");
    }
    if (!this.allowedRepos.has(repo.toLowerCase())) {
      throw new Error(`Repo "${repo}" is not in REPOMEDIC_ALLOWED_REPOS — write refused.`);
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status} on ${path}: ${body.slice(0, 400)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---- reads ----

  getRepo(repo: string) {
    return this.request<RepoDetails>(`/repos/${repo}`);
  }

  listOpenIssues(repo: string, perPage = 50) {
    return this.request<Issue[]>(
      `/repos/${repo}/issues?state=open&per_page=${perPage}&sort=updated&direction=asc`,
    );
  }

  listWorkflowRuns(repo: string, perPage = 10) {
    return this.request<WorkflowRunsResponse>(
      `/repos/${repo}/actions/runs?per_page=${perPage}`,
    );
  }

  async getDefaultBranchReadme(repo: string): Promise<{ text: string } | null> {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${repo}/readme`, {
        headers: {
          Accept: "application/vnd.github.raw",
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`README fetch failed: ${res.status}`);
      return { text: await res.text() };
    } catch {
      return null;
    }
  }

  async urlIsAlive(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "RepoMedic/0.1 (+hackathon)" },
      });
      if (res.status === 405) {
        const resGet = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "RepoMedic/0.1 (+hackathon)" },
        });
        return { ok: resGet.ok, status: resGet.status };
      }
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- gated writes ----

  fileIssue(repo: string, title: string, body: string, labels?: string[]) {
    this.assertWriteAllowed(repo);
    return this.request<Issue>(`/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body, labels: labels ?? [] }),
    });
  }

  postComment(repo: string, issueNumber: number, body: string) {
    this.assertWriteAllowed(repo);
    return this.request<Comment>(
      `/repos/${repo}/issues/${issueNumber}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
  }
}

// ---- minimal API shapes ----

export interface RepoDetails {
  full_name: string;
  default_branch: string;
  open_issues_count: number;
  description: string | null;
  pushed_at: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
  comments: number;
}

export interface WorkflowRunsResponse {
  total_count: number;
  workflow_runs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    head_branch: string;
    created_at: string;
    html_url: string;
  }>;
}

export interface Comment {
  id: number;
  html_url: string;
  body: string;
}
