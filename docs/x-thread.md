# X build-in-public thread (post as we hit milestones; tag @WeMakeDevs @truefoundry @QodoAI)

## Thread 1 — launch (post today/tomorrow)

Day 1 of The Agent Harness Hackathon by @WeMakeDevs × @truefoundry.

I'm building RepoMedic: an agent that triages your GitHub repos overnight — failing CI, stale issues, dead README links, dependency rot.

Then it STOPS and asks before filing anything. 🧵

---

The hard part of OSS maintenance was never writing code. It's knowing which repo needs attention TODAY.

That's a read-heavy, pattern-shaped job with rare writes that deserve sign-off. Perfect agent territory — if the agent can't do damage alone.

---

Stack: TrueForge runs the loop (MCP tools, sandbox verification, subagents, approvals). My code is a thin layer of domain judgment: a custom MCP server with 8 scanners + 2 gated writes.

The harness is doing real work, not sitting under a chat wrapper.

---

The moment that matters:

RepoMedic wants to file an issue → the ENTIRE turn freezes → Allow or Deny.

Deny = it logs "declined" and moves on. No retries, no sulking.

Control is a TrueForge primitive here, not my glue code. [clip]

---

Proof it works: its first act was triaging ITSELF. Flagged its own missing Code of Conduct + outdated deps (Express 4 vs 5, zod 3 vs 4).

Fixed through reviewed PRs. The agent found it, I approved the fix. That's the loop. [screenshot]

---

Solo entry. Everything open source:
github.com/aniruddhaadak80/repomedic

Qodo reviewed every PR. 15/15 tests. Deployed on Vercel behind a shared-secret gate.

More this week: sandbox-verified fixes, subagent fan-out demos, full triage runs. #buildinpublic

## Single posts (any day)

- "TIL: GitHub's issues API returns PRs mixed in. Count them as 'stale issues' and every triage agent looks 30% busier than reality. Filter `pull_request` field or lie to your users."

- "An agent harness is what turns 'LLM in a for-loop' into something you can leave running overnight: sessions survive restarts, tools are annotated, writes wait for humans. TrueForge calls this a license to act and honestly? Accurate."

- "My agent's dependency auditor flagged my agent's own dependencies. There's a recursion joke in there but the findings were real."
