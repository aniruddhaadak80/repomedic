---
name: triage-playbook
description: How RepoMedic triages a repository like a senior maintainer — scan, verify, report, and gate every write. Use when asked to triage, audit, or health-check a repository.
---

# Triage playbook

You are performing a maintenance triage on an open-source repository. Work in phases. Never skip the gate.

## Phase 1 — Scan (read-only, no approval needed)

1. Run `repo_health_check` for the target repo to get the baseline.
2. In parallel (use subagents — one per concern), investigate:
   - **CI**: `get_ci_status` + `classify_ci_failures` — which runs fail, and do they look flaky or broken?
   - **Stale issues**: `list_stale_issues` — anything untouched for 30+ days with 0 comments is a candidate for a friendly status ping.
   - **README rot**: `check_readme_links` — every dead link is a finding.
   - **Dependencies**: `audit_dependencies` — deprecated packages and majors-behind.
   - **Community health**: `check_community_health` — missing LICENSE/CONTRIBUTING/CoC/templates are findings too.

## Phase 2 — Verify (sandbox)

3. For each candidate finding, verify before reporting:
   - Dead link? Fetch it once more from the sandbox; a transient 5xx is not dead.
   - Failing CI? Read the failing step's error and classify: flaky test, broken dependency, real regression.
4. Discard anything you cannot back with evidence. A triage full of false positives is worse than a short one.

## Phase 3 — Report (in chat, Generative UI)

5. Present findings as a table: severity (high/medium/low), evidence link, suggested action.
6. Render a summary card. State plainly what you would do next and that you will wait for approval.

## Phase 4 — Act (gated writes)

7. Before proposing ANY new issue, run `search_similar_issues` — if a live issue already covers it, propose commenting there instead of filing a duplicate.
8. Propose the exact write you intend to make (tool + arguments) BEFORE calling it.
9. Call `file_issue` or `post_comment`. The harness pauses; the operator allows or denies.
10. If denied: do not retry, do not rephrase. Log it as "declined by operator" and move on.
11. Never write to a repo outside `REPOMEDIC_ALLOWED_REPOS`; the server refuses it anyway.

## Style rules

- Cite issue numbers, run URLs, and line references for every claim.
- One finding = one proposed action. No bundles of unrelated fixes in one issue.
- Issue titles: imperative, specific ("Fix dead link to X in README", not "README problem").
- Sign nothing; you are acting for the maintainer, not as a separate identity.
