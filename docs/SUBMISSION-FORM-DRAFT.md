# Submission form — final text (paste into the hackathon submission)

**Project name**

RepoMedic — the maintainer's night shift

**One-line description**

An autonomous open-source repository triage agent on TrueForge that reads everything, verifies findings in a sandbox, and refuses to file anything until a human presses Allow.

**What it does (short write-up)**

I've authored 800+ merged pull requests. The hard part of OSS was never writing code — it's knowing which repository needs attention *today*. RepoMedic is the agent I wanted: give it a repo you own and it scans failing CI (classifying flaky vs broken with step-level evidence), stale issues (PRs correctly filtered), README link rot (HEAD→GET fallback), dependency deprecations and major drift against the live npm registry, contributor concentration (bus factor), release drift, and community-file completeness.

Its flagship composite, `triage_priorities`, merges every scanner into one severity-ranked action list. Findings are verified in a TrueForge sandbox before reporting; duplicates are checked via issue search before anything is filed. Then the part nobody demos: every irreversible action (`file_issue`, `post_comment`) freezes the entire turn behind TrueForge's human-approval gate. Four independent layers separate the agent from your repos: MCP destructive annotations → harness approval policy → server-side repo allow-list → shared-secret transport auth.

TrueForge does the heavy lifting — model loop, MCP connectors, subagents, sessions that survive restarts, skills, sandbox-as-tool, approvals. My code is a thin layer of domain judgment: a custom TypeScript MCP server with 13 tools, plus the playbook skill teaching it triage procedure. It also drives headlessly through the official TypeScript SDK (`scripts/triage.mjs`).

The first thing RepoMedic did was triage its own repository — flagging its own missing Code of Conduct and outdated dependencies, which we then fixed through reviewed pull requests.

**Links**

- Public repo: https://github.com/aniruddhaadak80/repomedic
- Demo video (~3 min): ⟨ADD BEFORE SUBMITTING⟩
- Blog post: ⟨ADD DEV.TO LINK⟩
- Build-in-public thread: https://x.com/aniruddhadak

**Built by**

Aniruddha Adak (solo) — AI-assisted development disclosed per rules; architecture and code reviewed and understood by the author. Qodo reviewed pull requests on the way: ⟨CONFIRM/QODO STATUS⟩

---

## Track justification cheat-sheet (for your own reference, not the form)

| Criterion | Our evidence |
| --- | --- |
| Potential impact | Every maintainer's nightly triage, done safely |
| Creativity | Self-triage demo; bus-factor & release-drift angles nobody else will have |
| Technical excellence | 32 tests, CI + Vercel checks per PR, composite prioritizer, zero-dep landing |
| Sponsor tools | Harness central (loop/approvals/sandbox/subagents/skills/SDK); Qodo trail = PR history |
| Control & safety | Four documented layers; filmed Allow/Deny moment |
| Presentation | 3-min script ready (docs/demo-script.md); landing page at deployed URL |
