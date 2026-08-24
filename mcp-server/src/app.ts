import express from "express";
import type { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GithubClient } from "./lib/github.js";
import { registerScanners } from "./tools/scanners.js";
import { registerAdvancedTools } from "./tools/advanced.js";
import { registerWriters } from "./tools/writers.js";

export const SECRET_HEADER = "x-repomedic-secret";

function buildMcpServer(): McpServer {
  const gh = new GithubClient(
    process.env.GITHUB_TOKEN ?? "",
    (process.env.REPOMEDIC_ALLOWED_REPOS ?? "").split(","),
  );

  const server = new McpServer(
    { name: "repomedic-tools", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerScanners(server as never, gh);
  registerAdvancedTools(server as never, gh);
  registerWriters(server as never, gh);
  return server;
}

/**
 * Shared-secret gate for hosted deployments.
 * - REPOMEDIC_MCP_SECRET set  → every /mcp call must carry the matching header (TrueForge sends it via connector header auth).
 * - not set                   → open (local development only).
 * /health stays unauthenticated on purpose: it reports nothing but liveness.
 */
export function secretGate(req: Request, res: Response, next: NextFunction): void {
  const required = process.env.REPOMEDIC_MCP_SECRET;
  if (!required) {
    next();
    return;
  }
  if (req.headers[SECRET_HEADER] === required) {
    next();
    return;
  }
  res.status(401).json({ error: "Missing or invalid x-repomedic-secret header" });
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Human-friendly landing for anyone hitting the deployment root.
  app.get("/", (_req, res) => {
    res.json({
      service: "repomedic-tools",
      version: "0.1.0",
      description:
        "RepoMedic MCP server — autonomous OSS repository triage on the TrueForge agent harness.",
      hackathon: "The Agent Harness Hackathon (WeMakeDevs × TrueFoundry × Qodo), Aug 24–30 2026",
      endpoints: {
        health: "GET /health (open)",
        mcp: "POST /mcp (requires x-repomedic-secret header when REPOMEDIC_MCP_SECRET is set)",
      },
      tools: {
        read_only: [
          "repo_health_check",
          "list_stale_issues",
          "check_readme_links",
          "get_ci_status",
          "classify_ci_failures",
          "audit_dependencies",
          "check_community_health",
          "search_similar_issues",
        ],
        approval_gated: ["file_issue", "post_comment"],
      },
      repo: "https://github.com/aniruddhaadak80/repomedic",
    });
  });

  // Stateless streamable-HTTP mode: one transport per request, no session affinity to lose.
  app.post("/mcp", secretGate, async (req: Request, res: Response) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => void transport.close());
      await buildMcpServer().connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed:", err);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "repomedic-tools",
      auth: process.env.REPOMEDIC_MCP_SECRET ? "secret-required" : "open-local",
    });
  });

  return app;
}
