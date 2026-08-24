# Architecture

## The one-line pitch

RepoMedic is a **thin, honest layer of domain tools** on top of TrueForge: the harness runs the loop, we teach it *what a healthy repository looks like* and *where it must stop*.

## Component map

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TrueForge harness                             │
│  model loop · sessions · approvals · subagents · context mgmt        │
│                                                                      │
│  ┌────────────┐   ┌──────────────────┐   ┌─────────────────────────┐ │
│  │ Chat UI    │   │ repomedic agent  │   │ Sandbox (Daytona or     │ │
│  │ (built-in) │──▶│ spec (agents/)   │   │ local fallback, Linux)  │ │
│  └────────────┘   └────────┬─────────┘   └─────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ MCP (streamable HTTP)
              ┌───────────────┴───────────────┐
              ▼                               ▼
   ┌──────────────────┐            ┌──────────────────────┐
   │ github connector │            │ repomedic-tools      │
   │ (official,       │            │ (this repo's custom  │
   │  read-only here) │            │  server, mcp-server/)│
   └──────────────────┘            └──────────┬───────────┘
                                              │ REST
                                        ┌─────▼─────┐
                                        │  GitHub   │
                                        └───────────┘
```

## Why two MCP servers?

- The **official GitHub server** speaks raw GitHub. It is broad but generic.
- **repomedic-tools** encodes *triage judgment*: composite health checks, stale-issue logic that filters PRs out of the issues feed, link-rot detection with HEAD→GET fallback for servers that reject HEAD. Composite tools keep the model's context lean and its conclusions verifiable.

## The safety boundary

Three independent layers, deliberately redundant:

1. **MCP annotations** — writers declare `destructiveHint: true`; scanners declare `readOnlyHint: true`. This is metadata, not enforcement.
2. **Harness policy** — the agent spec sets `require_approval_for_tools: ["file_issue", "post_comment"]`, so TrueForge pauses the turn, renders Allow/Deny in the UI, and only resumes on Allow.
3. **Server-side allow-list** — even if layers 1–2 were bypassed, `GithubClient.assertWriteAllowed` refuses any write to a repo not in `REPOMEDIC_ALLOWED_REPOS` (and refuses *all* writes when it's empty). The blast radius equals the operator's config, never the agent's ambition.

## Design decisions worth defending

| Decision | Rationale |
| --- | --- |
| Streamable HTTP MCP over stdio | Lets TrueForge connect to the triage server as a plain URL — same shape as any remote tool deployment, no process management in the harness. |
| Stateless transports (one per request) | No session affinity to lose on restart; TrueForge owns session state. |
| Plain `fetch` against the GitHub REST API | Zero SDK lock-in; every call auditable in ~200 lines; tests mock at the fetch seam. |
| Gemini Flash by default | Triage is high-volume, structured work; Flash keeps cost near zero on the free tier. Pro is one dropdown away for gnarly investigations. |
| Skills for the playbook, not the prompt | Instructions stay short; the SKILL.md carries procedure and loads only when relevant. |
| PRs excluded from stale analysis | The GitHub issues API returns PRs too; counting them as "stale issues" is the classic triage false positive. |

## What runs where (hackathon demo topology)

- **TrueForge**: GitHub Codespace (Ubuntu) — TrueForge standalone does not support Windows yet (see upstream PR #374); Codespaces gives judges and the author an identical Linux environment via browser port-forwarding.
- **repomedic-tools**: same Codespace, `localhost:8815`.
- **Daytona sandbox**: cloud — OS-independent.
