import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GithubClient } from "./lib/github.js";
import { registerScanners } from "./tools/scanners.js";
import { registerWriters } from "./tools/writers.js";

const PORT = Number(process.env.PORT ?? 8815);

function buildServer(): McpServer {
  const gh = new GithubClient(
    process.env.GITHUB_TOKEN ?? "",
    (process.env.REPOMEDIC_ALLOWED_REPOS ?? "").split(","),
  );

  const server = new McpServer(
    { name: "repomedic-tools", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerScanners(server as never, gh);
  registerWriters(server as never, gh);
  return server;
}

const app = express();
app.use(express.json());

// Stateless streamable-HTTP mode: one transport per request.
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => void transport.close());
    await buildServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "repomedic-tools" }));

app.listen(PORT, () => {
  console.log(`repomedic-tools listening on http://localhost:${PORT}/mcp`);
  console.log(`writes restricted to: ${process.env.REPOMEDIC_ALLOWED_REPOS || "(none — writes disabled)"}`);
});
