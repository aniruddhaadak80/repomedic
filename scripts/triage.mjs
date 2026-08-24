#!/usr/bin/env node

/**
 * RepoMedic headless triage runner — drives the saved `repomedic` agent through
 * the TrueForge TypeScript SDK instead of the chat UI. Useful for cron-style
 * night-shift runs; proves the harness works as an API, not just a chat box.
 *
 * Setup:
 *   cd scripts && npm install          # installs @truefoundry/trueforge-sdk
 *   TRUEFORGE_BASE_URL=http://localhost:8790 node triage.mjs owner/repo
 *
 * Docs: https://trueforge.dev/api/quickstart and /api/use-agent (approvals).
 */

import { TrueForge } from "@truefoundry/trueforge-sdk";

const repo = process.argv[2];
if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
  console.error("Usage: node triage.mjs <owner/repo>");
  process.exit(1);
}

const client = new TrueForge({
  baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790",
});

const { data: session } = await client.sessions.create({ agent: { name: "repomedic" } });
console.error(`session ${session.id} opened against ${client.baseUrl}`);

const stream = await client.sessions.createTurnStream(session.id, {
  input: [
    {
      type: "user.message",
      content: `Triage ${repo}: find what's broken, verify what you can in the sandbox, hold every write for my approval.`,
    },
  ],
});

let deniedWrites = 0;
for await (const { data: event } of stream.withMetadata()) {
  switch (event.type) {
    case "tool.approval.requested":
      console.error(`[approval] ${event.tool ?? "tool"} wants to run — approve via UI or API`);
      break;
    case "tool.approval.denied":
      deniedWrites += 1;
      console.error(`[denied] write declined by operator (#${deniedWrites})`);
      break;
    case "turn.completed":
      console.log("=== final output ===");
      console.log(event.output ?? JSON.stringify(event));
      break;
    default:
      console.error(`[${event.type}]`);
  }
}
