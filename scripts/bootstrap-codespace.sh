#!/usr/bin/env bash
# RepoMedic — one-shot Codespace bootstrap.
#
# Run this inside your GitHub Codespace (or any Linux box):
#   bash scripts/bootstrap-codespace.sh
#
# What it does:
#   1. Starts the TrueForge harness (localhost:8790) in the background
#   2. Builds + starts the repomedic-tools MCP server (localhost:8815)
#   3. Registers the connector, imports nothing by hand, and creates the
#      saved `repomedic` agent through the TrueForge API where supported —
#      with clear fallback instructions for anything UI-only.
#
# Secrets are prompted interactively and NEVER written to disk.

set -uo pipefail

BOLD=$'\033[1m'; GREEN=$'\033[32m'; CYAN=$'\033[36m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; OFF=$'\033[0m'
say()  { echo "${CYAN}▶${OFF} $*"; }
ok()   { echo "${GREEN}✔${OFF} $*"; }
warn() { echo "${YELLOW}⚠${OFF} $*"; }
die()  { echo "${RED}✖ $*${OFF}"; exit 1; }

command -v node >/dev/null || die "Node.js is required (>=22.14)."
command -v curl >/dev/null || die "curl is required."

echo "${BOLD}RepoMedic bootstrap${OFF}"
echo "-------------------"

# ---- secrets (interactive, not stored) ----
read -rsp "Gemini API key (aistudio.google.com/apikey): " GEMINI_API_KEY; echo
[[ -n "$GEMINI_API_KEY" ]] || die "Gemini key required."
read -rsp "GitHub PAT with repo scope (for the triage tools): " GH_TOKEN; echo
[[ -n "$GH_TOKEN" ]] || die "GitHub PAT required."
read -rp  "Repos RepoMedic may write to, comma-separated [aniruddhaadak80/repomedic]: " ALLOWED
ALLOWED=${ALLOWED:-aniruddhaadak80/repomedic}
SECRET="rmc-$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
read -rsp "Daytona API key (optional now, needed for sandbox demos): " DAYTONA_API_KEY; echo

# ---- 1. harness ----
say "Starting TrueForge on :8790 ..."
nohup npx --yes @truefoundry/trueforge@latest --port 8790 > trueforge.log 2>&1 &
TF_PID=$!
for i in $(seq 1 60); do curl -sf -o /dev/null "http://localhost:8790" && break; sleep 2; done
curl -sf -o /dev/null "http://localhost:8790" && ok "TrueForge up (pid $TF_PID)" || die "TrueForge did not start — see trueforge.log"

# ---- 2. triage tool server ----
say "Building + starting repomedic-tools on :8815 ..."
( cd mcp-server && npm ci --silent && npm run build --silent )
GITHUB_TOKEN="$GH_TOKEN" \
REPOMEDIC_ALLOWED_REPOS="$ALLOWED" \
REPOMEDIC_MCP_SECRET="$SECRET" \
PORT=8815 nohup node mcp-server/dist/index.js > mcp.log 2>&1 &
MCP_PID=$!
for i in $(seq 1 20); do curl -sf -o /dev/null "http://localhost:8815/health" && break; sleep 1; done
curl -sf -o /dev/null "http://localhost:8815/health" && ok "repomedic-tools up (pid $MCP_PID)" || die "MCP server did not start — see mcp.log"

# ---- 3. configure TrueForge via API (best effort; fall back to UI) ----
api() { # method path json -> http code
  curl -s -o /tmp/tf-resp.json -w "%{http_code}" -X "$1" "http://localhost:8790$2" \
    -H "Content-Type: application/json" ${3:+-d "$3"}
}

say "Registering Gemini provider ..."
code=$(api POST /api/v1/model-providers "{\"provider\":\"google\",\"apiKey\":\"$GEMINI_API_KEY\"}")
case "$code" in
  200|201) ok "Gemini registered via API" ;;
  *) warn "API endpoint unavailable ($code). Paste the key in Settings → Models → Google instead." ;;
esac

say "Registering repomedic-tools connector ..."
code=$(api POST /api/v1/mcp-servers "{\"name\":\"repomedic-tools\",\"url\":\"http://localhost:8815/mcp\",\"headers\":{\"x-repomedic-secret\":\"$SECRET\"}}")
case "$code" in
  200|201) ok "Connector registered via API" ;;
  *) warn "API unavailable ($code). Use Settings → Connectors → Add MCP Server:
     URL http://localhost:8815/mcp · header x-repomedic-secret: $SECRET" ;;
esac

say "Creating the saved 'repomedic' agent ..."
code=$(api POST /api/v1/agents @agents/repomedic.agent.json)
case "$code" in
  200|201) ok "Agent created via API" ;;
  409) ok "Agent already exists" ;;
  *) warn "API unavailable ($code). Assemble it in chat and Save Agent as 'repomedic'." ;;
esac

# ---- summary ----
cat <<EOF

${BOLD}══════════════════════════════════════════════${OFF}
${GREEN}RepoMedic is running.${OFF}
  Harness UI : ${CYAN}http://localhost:8790${OFF}  (Codespaces: Ports tab → 8790 → open in browser)
  MCP server : http://localhost:8815/mcp   (pid $MCP_PID)
  Secret     : $SECRET
  Writes to  : $ALLOWED
${YELLOW}If any step above printed a ⚠, finish that one piece in the UI.${OFF}
Then open the chat, pick your Gemini model, attach repomedic-tools,
and send:

  Triage aniruddhaadak80/smart-resume-analyzer: find what's broken,
  verify in the sandbox, hold every write for my approval.

Kill everything later with: kill $TF_PID $MCP_PID 2>/dev/null
${BOLD}══════════════════════════════════════════════${OFF}
EOF
