# Contributing to RepoMedic

Thanks for helping! This repo was built for The Agent Harness Hackathon (Aug 24–30 2026), and it follows the workflow the hackathon rewards — every change goes through a reviewed pull request.

## Workflow

1. Branch from `main`: `git checkout -b feat/your-thing`
2. Make your change. Keep tools read-only unless they are deliberately gated writes.
3. Run locally:
   ```bash
   npm install
   npm run build -w mcp-server
   npm test -w mcp-server
   ```
4. Open a PR. CI must be green; Qodo review findings get addressed before merge.

## Ground rules

- **Writes are sacred**: any tool that mutates GitHub state must declare `destructiveHint: true` and go through `GithubClient.assertWriteAllowed`. No exceptions.
- **Reads stay cheap**: composite scanners should return structured JSON, capped in size (`max_packages`-style bounds).
- **No secrets, ever**: nothing in `.env*` is committed; new config goes through `.env.example` documentation first.
- **Explain your why** in the PR description — judges and strangers both read this trail.
