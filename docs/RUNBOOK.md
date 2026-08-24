# Judges' runbook — reproduce RepoMedic in ~5 minutes

Everything here was verified on a clean environment. If any step fails, that's a bug — open an issue.

## Option A — hosted triage tools only (2 minutes, no install)

The custom MCP server is deployed:

- Health: `GET https://repomedic-gules.vercel.app/health` → `{"ok":true,...}`
- MCP endpoint: `POST https://repomedic-gules.vercel.app/mcp` (requires the shared-secret header; see below for why we can't publish it)

Point any MCP client at it with header auth, or read the code — every tool is < 100 lines of auditable TypeScript under `mcp-server/src/`.

## Option B — full stack (TrueForge harness + agent)

Requirements: Node ≥ 22.14, a GitHub account, a Gemini API key (free tier is fine), a Daytona API key (free tier), and **a Linux/macOS shell** (WSL2, Codespaces, or any Unix box). TrueForge standalone does not boot on native Windows yet — upstream tracking in truefoundry/trueforge#374; GitHub Codespaces is the zero-setup path and what we used.

```bash
# 1. Harness
npx @truefoundry/trueforge            # → http://localhost:8790

# 2. Model: Settings → Models → Google → paste Gemini key

# 3. Tools:
#    Settings → Connectors → Add MCP Server
#      URL: http://localhost:8815/mcp   (after step 4)
#      Headers: x-repomedic-secret: <value of your REPOMEDIC_MCP_SECRET>
#    Also connect the official GitHub catalog server (header auth with your PAT)

# 4. RepoMedic's tool server
git clone https://github.com/aniruddhaadak80/repomedic && cd repomedic/mcp-server
npm install && npm run build
REPOMEDIC_MCP_SECRET=<pick-a-random-string> \
REPOMEDIC_ALLOWED_REPOS=<your-owner>/<your-repo> \
GITHUB_TOKEN=<your-PAT-with-repo-scope> \
npm start                              # → :8815

# 5. Sandbox: Settings → Sandbox providers → Daytona → paste key

# 6. Skill: Settings → Skills → Import from GitHub → this repo, path skills/triage-playbook

# 7. Agent: chat composer → attach both connectors + skill, enable sandbox,
#    Save Agent as "repomedic" (or POST agents/repomedic.agent.json to /api/v1/agents)

# 8. Run it:
#    "Triage <owner>/<repo>: find what's broken, verify in the sandbox,
#     hold every write for my approval."
```

Expected behavior: parallel subagent scans → evidence table with severities → proposed write freezes the turn on an Allow/Deny card → Deny logs and moves on.

## Headless run (optional flex)

```bash
cd scripts && npm install
TRUEFORGE_BASE_URL=http://localhost:8790 node triage.mjs <owner>/<repo>
```

Same saved agent, driven through the TypeScript SDK instead of the chat UI.
