import { z } from "zod";
import { GithubClient, OwnerRepo } from "../lib/github.js";
import type { RegistrableServer } from "./scanners.js";

/**
 * Gated write actions. Every tool here declares a `destructiveHint`, so
 * TrueForge's default approval policy
 * (require_approval_for_tools: ["@write", "@destructive"]) pauses the agent,
 * shows the tool name and arguments, and resumes only when the human picks
 * Allow or Deny in the chat UI.
 */
export function registerWriters(server: RegistrableServer, gh: GithubClient): void {
  const gated = {
    destructiveHint: true,
    readOnlyHint: false,
    openWorldHint: true,
  } as const;

  server.registerTool(
    "file_issue",
    {
      title: "File an issue",
      description:
        "Open a new issue on a repository. IRREVERSIBLE public write — the harness pauses for human approval before running this.",
      inputSchema: {
        repo: OwnerRepo.describe("Target repository, as `owner/repo`"),
        title: z.string().min(3).max(256).describe("Concise issue title"),
        body: z.string().min(10).describe("Issue body in GitHub-flavored Markdown"),
        labels: z.array(z.string()).max(10).optional().describe("Optional labels to attach"),
      },
      annotations: gated,
    },
    async ({ repo, title, body, labels }) => {
      const issue = await gh.fileIssue(repo, title, body, labels);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ filed: true, number: issue.number, url: issue.html_url }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "post_comment",
    {
      title: "Post a comment",
      description:
        "Comment on an existing issue. IRREVERSIBLE public write — the harness pauses for human approval before running this.",
      inputSchema: {
        repo: OwnerRepo.describe("Target repository, as `owner/repo`"),
        issue_number: z.number().int().positive().describe("Issue number to comment on"),
        body: z.string().min(5).describe("Comment body in GitHub-flavored Markdown"),
      },
      annotations: gated,
    },
    async ({ repo, issue_number, body }) => {
      const comment = await gh.postComment(repo, issue_number, body);
      return {
        content: [
          { type: "text", text: JSON.stringify({ posted: true, url: comment.html_url }, null, 2) },
        ],
      };
    },
  );
}
