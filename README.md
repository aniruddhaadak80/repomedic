# RepoMedic 🩺

[![CI](https://github.com/aniruddhaadak80/repomedic/actions/workflows/ci.yml/badge.svg)](https://github.com/aniruddhaadak80/repomedic/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.14-green.svg)](https://nodejs.org)
![Hackathon](https://img.shields.io/badge/The_Agent_Harness_Hackathon-TrueForge-8A2BE2)

> An autonomous open-source repository triage agent, built on [TrueForge](https://github.com/truefoundry/trueforge) — the open-source agent harness — for **The Agent Harness Hackathon** (WeMakeDevs × TrueFoundry × Qodo, Aug 24–30 2026).

RepoMedic is the maintenance agent every maintainer wishes they had: it scans your repositories for real problems — failing CI, broken links in the README, stale issues, vulnerable dependencies — investigates each one in a sandboxed environment with parallel subagents, and then **stops and asks a human before anything irreversible**: no issue is filed, no comment posted, no PR opened until you approve it in the chat.

```
┌─────────────┐    MCP     ┌──────────────────┐   approval gate   ┌─────────┐
│  You (chat) │◄──────────►│  TrueForge harness│◄──(Allow / Deny)─►│ GitHub  │
└─────────────┘            │  · model loop     │                   └─────────┘
                           │  · subagents      │        read-only scans run free,
                           │  · sandbox runs   │        every write pauses for you
                           └──────────────────┘
```

## What it does

| Capability | How RepoMedic uses it |
| --- | --- |
| **Real MCP tools** | Official GitHub MCP server + RepoMedic's own custom MCP server (`mcp-server/`) for repo health checks |
| **Sandbox code execution** | Fix candidates and link checks are verified by running code in an isolated Daytona sandbox before anyone sees them |
| **Human approval gate** | Every write action (`file_issue`, `post_comment`, `open_pr`) is annotated destructive and pauses the agent until you choose Allow or Deny |
| **Subagents** | Fan out across repos/issues in parallel; only merged findings return to the main context |
| **Sessions that survive reconnects** | A triage run survives a browser refresh or server restart |
| **Skills** | `triage-playbook` SKILL.md teaches RepoMedic *how* to triage like a senior maintainer |
| **Generative UI** | Triage reports render as cards/charts inline in chat |

## Tool belt

| Tool | Gate | What it does |
| --- | --- | --- |
| `repo_health_check` | free | Composite snapshot: issues, stale counts, CI conclusions, README presence |
| `list_stale_issues` | free | Untouched issues (PRs filtered out), sorted by staleness |
| `check_readme_links` | free | HEAD→GET link verification with dead-link report |
| `get_ci_status` | free | Recent workflow runs with conclusions |
| `classify_ci_failures` | free | Flaky-vs-broken verdict per failing run, with step evidence |
| `audit_dependencies` | free | Deprecated packages + majors-behind, via npm registry |
| `check_community_health` | free | LICENSE/CONTRIBUTING/CoC/SECURITY/templates scoring |
| `search_similar_issues` | free | Dedupe check before proposing a new issue |
| `file_issue` | 🔒 approval | Opens an issue — pauses for Allow/Deny |
| `post_comment` | 🔒 approval | Comments on an issue — pauses for Allow/Deny |

## Advanced usage

**Headless night-shift runs** — drive the saved agent through the TrueForge TypeScript SDK instead of the chat UI:

```bash
cd scripts && npm install
TRUEFORGE_BASE_URL=http://localhost:8790 node triage.mjs owner/repo
```

Approval requests stream through the same session — deny one and the agent logs it and moves on.

## Quickstart

### Prerequisites

- Node.js ≥ 22.14
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/apikey)) — free tier works
- A GitHub personal access token (classic, `repo` scope) — RepoMedic only needs to touch repos you own
- A [Daytona](https://www.daytona.io/) API key (free tier) — powers TrueForge's sandbox-as-tool

### 1. Start the harness

```bash
npx @truefoundry/trueforge
# UI opens at http://localhost:8790
```

### 2. Connect model + tools (Settings)

1. **Settings → Models → Google → Configure** — paste your Gemini API key.
2. **Settings → Connectors** — add:
   - **GitHub** (catalog entry; header auth with your PAT)
   - **repomedic-tools** (custom server, see below)
3. **Settings → Sandbox providers** — Daytona, paste your API key.

### 3. Connect the RepoMedic MCP server

**Hosted (recommended):** the triage tools run at `https://repomedic-gules.vercel.app/mcp`. Under **Settings → Connectors → Add MCP Server**, register that URL with header auth:

```
x-repomedic-secret: <your REPOMEDIC_MCP_SECRET>
```

Deploy your own with `vercel deploy --prod` after setting env vars (`GEMINI_API_KEY`, `GITHUB_TOKEN`, `REPOMEDIC_MCP_SECRET`, `REPOMEDIC_ALLOWED_REPOS`). Every `/mcp` request without the secret is rejected 401; `/health` is open.

**Local:**

```bash
cd mcp-server
npm install
npm run build && npm start
# Serves on http://localhost:8815/mcp (open — set REPOMEDIC_MCP_SECRET to lock it down)
```

### 4. Import the skill

**Settings → Skills → Import from GitHub** → point it at this repo's `skills/triage-playbook`.

### 5. Create the agent & go

In chat: pick your Gemini model, attach the two connectors, enable the skill and sandbox, save as `repomedic` — or POST `agents/repomedic.agent.json` through the API (see `docs/architecture.md`). Then:

```text
Triage github.com/<you>/<your-repo>: find what's broken, verify what you can in the
sandbox, and hold every write for my approval.
```

## Repository layout

```
repomedic/
├── agents/repomedic.agent.json   # full TrueForge agent spec (API format)
├── mcp-server/                   # our custom MCP server (TypeScript)
│   ├── src/
│   │   ├── index.ts              # server entry (streamable HTTP on :8815)
│   │   ├── tools/                # read-only scanners + gated write actions
│   │   └── lib/github.ts         # thin GitHub REST client
│   └── tests/                    # vitest suite
├── skills/triage-playbook/SKILL.md
├── docs/
│   ├── architecture.md           # how the pieces fit, design decisions
│   ├── WRITEUP.md                # hackathon submission write-up
│   └── demo-script.md            # 3-minute demo storyboard
└── .github/workflows/ci.yml      # lint + typecheck + test on every PR
```

## Safety model

Four independent layers:

1. **MCP annotations** — writers declare `destructiveHint: true`; scanners `readOnlyHint: true`. Metadata, not enforcement.
2. **Harness approval policy** — agent spec pins `require_approval_for_tools: ["file_issue", "post_comment"]`; TrueForge freezes the turn until you choose.
3. **Server-side allow-list** — `GithubClient.assertWriteAllowed` refuses any write outside `REPOMEDIC_ALLOWED_REPOS`, and refuses *all* writes when it's unset. The blast radius equals your config, never the agent's ambition.
4. **Transport auth** — hosted deployments require the `x-repomedic-secret` header on every `/mcp` call (401 otherwise); `/health` stays open for liveness only.

**Secrets stay out of git** — `.env.example` documents every variable; no key lands in this repo or the demo video.

## AI-assistance disclosure

Built for The Agent Harness Hackathon by Aniruddha Adak with AI coding assistants (OpenCode), disclosed per hackathon rules. Architecture, prompts, tool design, and final code reviewed and understood by the author. Qodo reviewed every pull request on the way here.

## License

MIT
