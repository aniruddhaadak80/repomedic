# Demo video script (~3 minutes)

Target: show the problem, the agent working, and the moment it stops. Film at 1080p, browser zoomed to ~125%, clean desktop, close other tabs.

## Beat sheet

| Time | On screen | Say (draft) |
| --- | --- | --- |
| 0:00–0:20 | Repo with stale issues + broken README link visible | "Maintainers don't lack dashboards. They lack someone doing triage at 1 AM. I have 800+ merged PRs — I wanted an agent that could do this job *safely*." |
| 0:20–0:45 | TrueForge UI, agent selector shows `repomedic`; type the triage prompt | "This is RepoMedic on TrueForge, TrueFoundry's open-source agent harness. One prompt: triage my repo." |
| 0:45–1:30 | Agent-steps panel expanded: health-check tool call, subagent fan-out | "It scans through real MCP tools — its own custom triage server plus GitHub. Watch the steps panel: subagents fan out per concern, read-only, no approvals needed." |
| 1:30–2:10 | Sandbox step + findings table rendered via Generative UI | "Findings get verified in a sandbox before you see them — a transient 500 isn't link rot. Then it reports: severity, evidence, proposed action." |
| 2:10–2:40 | THE MOMENT: Allow / Deny card for `file_issue` | "Now the part nobody demos: control. It wants to file an issue — an irreversible public write. The harness pauses the entire turn. Deny, and it logs and moves on. Allow, and it acts. That gate is a TrueForge primitive, not my glue code." |
| 2:40–2:52 | Show the community-health finding on repomedic's own repo + the fix PR | "Proof it works: its first act was triaging *itself* — flagged its own missing Code of Conduct and outdated dependencies. We fixed what it found through reviewed pull requests." |
| 2:52–3:00 | Show repo allow-list env var + README safety section; end card | "Four layers of gating, one config file. RepoMedic: give your repos a doctor you can overrule. Built in a week on TrueForge." |

## Shot list / captures needed

- [ ] Browser: TrueForge chat, full triage run start-to-finish (record the whole thing, cut later)
- [ ] Close-up: Agent steps panel showing subagent traces
- [ ] Close-up: sandbox execution evidence
- [ ] Close-up: Allow/Deny pause card (also capture a DENY and its graceful handling)
- [ ] Terminal: `repomedic-tools` boot log showing the allow-list line
- [ ] End card: repo URL + hackathon name

## Rules checklist for the video

- No API keys or tokens visible anywhere
- Only repos you own are touched on camera
- The approval pause is shown, not described
