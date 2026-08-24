# I built an agent that triages my repos — and it started by auditing itself

*Building RepoMedic on TrueForge for The Agent Harness Hackathon (WeMakeDevs × TrueFoundry × Qodo), day one.*

> Status: draft — publish on DEV.to after the demo video is shot; add screenshots where marked.

I've authored 800+ pull requests across open source. Here's the thing nobody tells you about that number: the PRs were never the hard part. The hard part was knowing which of the 147 repos I maintain actually needed attention *today*. Failing CI on a repo you forgot about. A README linking to a tutorial that died in 2024. An issue sitting stale for two months because nobody wanted to be the one to say "is this still relevant?"

That job is exactly what an agent should do: high-volume, pattern-shaped, read-heavy — with rare writes that deserve human sign-off. So when WeMakeDevs and TrueFoundry announced a hackathon around **TrueForge**, their open-source agent harness, I didn't build a chatbot wrapper. I built the maintainer's night shift.

## What RepoMedic does

Give it a repo you own. It scans for real problems:

- **Failing CI** — then classifies each failure as likely-flaky or likely-broken by reading job steps
- **Stale issues** — filtered correctly (GitHub's issues API returns PRs too; most naive implementations count them)
- **README link rot** — HEAD requests with GET fallback, because half the internet rejects HEAD
- **Dependency drift** — deprecated packages and majors-behind, checked against the npm registry live
- **Community health** — missing LICENSE/CONTRIBUTING/Code of Conduct/templates, scored

Then it verifies findings in a sandboxed environment, dedupes against existing issues so it never files duplicates, renders an evidence table in chat — and stops. Every irreversible action (`file_issue`, `post_comment`) freezes the entire turn until a human picks Allow or Deny.

## The first thing it did was audit itself

[Screenshot: check_community_health output]

RepoMedic's community-health tool scored its own repository 5/8 and listed exactly what was missing: a Code of Conduct, issue templates, funding config. Its dependency auditor flagged that this project — a tool whose whole job is flagging outdated dependencies — was itself running Express 4 while 5.x is current.

So we fixed what it found, through reviewed pull requests. That loop is the product demo: agent finds → human approves → repo gets healthier.

## Where TrueForge earns its keep

The temptation in every agent hackathon is to build your own execution loop and call it "infrastructure". I went the other direction: **the harness runs everything**, and my code is a thin layer of domain judgment.

What TrueForge handled so I didn't write it:

| Capability | What it meant for RepoMedic |
| --- | --- |
| MCP connectors | My custom triage server + GitHub's official server, attached by name |
| Human checkpoints | `require_approval_for_tools` froze every write until I clicked Allow — one config line |
| Sandbox-as-tool | Fix candidates verified in a Daytona sandbox before reporting |
| Dynamic subagents | One subagent per concern, results merged into main context |
| Session persistence | Triage runs survive browser refreshes — a real night-shift property |
| Skills | The triage playbook lives in a git-backed SKILL.md, loaded only when relevant |
| SDK | `scripts/triage.mjs` drives the same saved agent headlessly through the TypeScript SDK |

The approval gate deserves special mention because it's the part everyone skips. An agent that can open issues on your repos is one prompt-injection away from embarrassing you publicly. TrueForge treats "pause and ask" as a primitive, not an afterthought — and it demos beautifully: [Screenshot: Allow/Deny card]

## Four layers between the agent and your repos

1. **MCP annotations** — writers declare `destructiveHint: true`
2. **Harness policy** — `require_approval_for_tools` pauses the turn for Allow/Deny
3. **Server-side allow-list** — even bypassing layers 1–2, writes outside `REPOMEDIC_ALLOWED_REPOS` are refused at the API client level; unset means *all* writes are disabled
4. **Transport auth** — hosted deployment requires a shared-secret header on every call

Defense in depth isn't paranoia; it's what makes "autonomous" safe to say out loud.

## What broke

- TrueForge standalone doesn't boot on Windows yet (Unix-socket dependency in the code-mode bootstrap — upstream PR #374 is fixing it). GitHub Codespaces gave me an identical Linux environment in the browser. Judges get the same path via the README.
- npm's optional-dependencies bug (npm/cli#4828) broke CI for Linux rollup binaries born from a Windows lockfile. Pinned the native package explicitly.
- Vercel bundled the ESM-only MCP SDK into a CJS lambda and everything failed at import time. One `"type": "module"` fixed it; the error message ("Received protocol 'c:'") will haunt me.

## Stack summary

TrueForge harness · Gemini Flash (free tier — triage is high-volume structured work) · custom MCP server in TypeScript (Express + official MCP SDK) · GitHub REST via plain fetch · Daytona sandbox · Vercel hosting · Qodo reviewing every PR.

## Links

- Repo: https://github.com/aniruddhaadak80/repomedic
- Demo video: *(add before submitting)*
- Built solo for The Agent Harness Hackathon, Aug 24–30 2026. AI-assisted development disclosed per rules.
