# RepoMedic — submission write-up (draft, finalize before Aug 30)

> Status: skeleton now; fill the "results" section with real runs and screenshots during the week.

## What it is

RepoMedic is an autonomous repository triage agent for open-source maintainers, built on **TrueForge**, TrueFoundry's open-source agent harness. Give it a repo you own and it scans for failing CI, stale issues, README link rot, then verifies each finding in a sandboxed environment and reports back with evidence. Every irreversible action — filing an issue, posting a comment — pauses until a human presses Allow.

## The job I gave the agent

I've authored 800+ pull requests across open source. The bottleneck was never writing code; it was triage: knowing *what* needs attention in a repository right now. That job is exactly what an agent should do — high-volume, pattern-shaped, read-heavy, with rare writes that deserve human sign-off. So I built the maintainer's night-shift: an agent that does all the reading and none of the publishing without permission.

## How TrueForge does the heavy lifting

| Harness capability | Where RepoMedic leans on it |
| --- | --- |
| MCP connectors | Two servers: official GitHub connector (read-only) + my custom `repomedic-tools` server exposing composite health checks |
| Human checkpoints | `require_approval_for_tools` gates `file_issue` / `post_comment`; the turn freezes on Allow/Deny |
| Sandbox-as-tool | Findings are re-verified by executing code in a Daytona sandbox before reporting |
| Dynamic subagents | One subagent per concern (CI / stale issues / link rot), results merged |
| Session persistence | Triage runs survive refreshes and restarts — a real night-shift property |
| Skills | The triage playbook lives in a git-backed SKILL.md, loaded only when relevant |
| Generative UI | Findings render as evidence tables/cards inline in chat |

## What broke along the way

- TrueForge standalone doesn't start on Windows yet (Unix-socket dependency in code-mode bootstrap; upstream PR #374 in flight). Solution: GitHub Codespaces gives an identical Linux env through the browser. Documented so judges can reproduce.
- GitHub's issues API returns PRs mixed into issue lists — counting them as stale issues is the classic false positive; filtered explicitly in `list_stale_issues`.
- Some sites reject HEAD probes; the link checker falls back to GET before declaring a link dead.

## Results

(to fill: N repos triaged, M findings, X true positives confirmed manually, cost per run on Gemini Flash, demo video link)

## Safety posture

Three redundant gates: MCP destructive annotations → harness approval policy → server-side repo allow-list that refuses writes outside `REPOMEDIC_ALLOWED_REPOS` (and refuses everything when unset). Keys live in env vars, never in git or on camera.

## Build-in-public trail

- Qodo reviewed every PR in this repo from day one (trail visible in the PR history)
- Devlog thread on X: (link)
- Blog post: (DEV.to link once published)
