# Security Policy

## Supported

The `main` branch of this hackathon repository.

## Reporting a vulnerability

Email aniruddhaadak80@gmail.com directly — please do not open a public issue for security reports. Expect a reply within 48 hours during the hackathon week.

## Design notes

RepoMedic's write surface is deliberately triple-gated: MCP destructive annotations → TrueForge human-approval policy → server-side repo allow-list (`REPOMEDIC_ALLOWED_REPOS`). Hosted deployments additionally require the `x-repomedic-secret` header on every `/mcp` call. If you find a path around any of these, that is exactly what we want to hear about.
