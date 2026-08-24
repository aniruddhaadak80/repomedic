/**
 * Self-contained landing page served at GET /.
 * No external fonts, no JS, no build step — everything inline so the page
 * renders instantly anywhere, including air-gapped judge machines.
 */
export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RepoMedic — autonomous OSS triage on TrueForge</title>
<meta name="description" content="An autonomous repository triage agent built on the TrueForge agent harness. Reads fearlessly, writes only with permission.">
<style>
  :root {
    --bg: #070d12;
    --bg-soft: #0c141c;
    --card: #101a24;
    --line: #1b2a38;
    --text: #dbe7f0;
    --muted: #7d93a8;
    --green: #34d399;
    --cyan: #22d3ee;
    --amber: #fbbf24;
    --red: #f87171;
    --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    background:
      radial-gradient(1100px 500px at 80% -10%, rgba(34,211,238,.08), transparent 60%),
      radial-gradient(900px 420px at 10% 110%, rgba(52,211,153,.07), transparent 60%),
      var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    line-height: 1.6;
    min-height: 100vh;
  }
  .wrap { max-width: 1060px; margin: 0 auto; padding: 48px 24px 64px; }
  .mono { font-family: var(--mono); }

  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .pulse { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--green); border: 1px solid rgba(52,211,153,.35); background: rgba(52,211,153,.06); padding: 6px 14px; border-radius: 999px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 0 rgba(52,211,153,.6); animation: p 2s infinite; }
  @keyframes p { 70% { box-shadow: 0 0 0 9px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }

  .badge { display: inline-block; font-family: var(--mono); font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--cyan); border: 1px solid rgba(34,211,238,.3); background: rgba(34,211,238,.05); padding: 5px 12px; border-radius: 999px; margin-top: 40px; }
  h1 { font-size: clamp(44px, 7vw, 76px); line-height: 1.05; letter-spacing: -.02em; margin: 18px 0 10px; font-weight: 800; }
  h1 .grad { background: linear-gradient(92deg, var(--green) 10%, var(--cyan) 60%, var(--cyan)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  h1 .steth { filter: grayscale(.1); }
  .tagline { font-size: clamp(17px, 2.4vw, 21px); color: var(--muted); max-width: 720px; }
  .tagline b { color: var(--text); font-weight: 600; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 36px 0 8px; }
  .stat { background: linear-gradient(180deg, var(--card), var(--bg-soft)); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; transition: transform .18s ease, border-color .18s ease; }
  .stat:hover { transform: translateY(-2px); border-color: rgba(34,211,238,.4); }
  .stat .n { font-family: var(--mono); font-size: 26px; font-weight: 700; color: var(--cyan); }
  .stat .l { font-size: 13px; color: var(--muted); }

  section { margin-top: 56px; }
  h2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
  h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .tool { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; position: relative; overflow: hidden; transition: transform .15s ease, border-color .15s ease; }
  .tool:hover { transform: translateY(-2px); }
  .tool::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--green); opacity: .85; }
  .tool.locked::before { background: var(--amber); }
  .tool code { font-family: var(--mono); font-size: 14.5px; color: var(--text); }
  .tool span { display: block; margin-top: 4px; font-size: 12.5px; color: var(--muted); }
  .lock { float: right; font-family: var(--mono); font-size: 11px; color: var(--amber); border: 1px solid rgba(251,191,36,.35); padding: 2px 8px; border-radius: 999px; background: rgba(251,191,36,.06); }
  .free { float: right; font-family: var(--mono); font-size: 11px; color: var(--green); border: 1px solid rgba(52,211,153,.3); padding: 2px 8px; border-radius: 999px; background: rgba(52,211,153,.06); }

  .terminal { background: #0a1119; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .term-bar { display: flex; gap: 6px; padding: 11px 14px; border-bottom: 1px solid var(--line); background: #0d1520; }
  .term-bar i { width: 10px; height: 10px; border-radius: 50%; display: block; }
  .terminal pre { padding: 20px; font-family: var(--mono); font-size: 13.5px; line-height: 1.75; overflow-x: auto; color: #a8bccb; }
  .c1 { color: var(--green); } .c2 { color: var(--cyan); } .c3 { color: var(--amber); } .dim { color: #54697c; }

  ol.layers { counter-reset: s; list-style: none; display: grid; gap: 10px; }
  ol.layers li { counter-increment: s; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 15px 18px 15px 58px; position: relative; }
  ol.layers li::before { content: counter(s); position: absolute; left: 16px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; font-family: var(--mono); font-weight: 700; font-size: 13px; color: var(--cyan); border: 1px solid rgba(34,211,238,.35); border-radius: 8px; background: rgba(34,211,238,.05); }
  ol.layers b { color: var(--text); }
  ol.layers small { color: var(--muted); display: block; }

  .cta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 30px; }
  .btn { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; font-weight: 650; font-size: 15px; padding: 13px 24px; border-radius: 12px; transition: transform .15s ease, filter .15s ease; }
  .btn:hover { transform: translateY(-2px); filter: brightness(1.08); }
  .btn.primary { background: linear-gradient(92deg, #0ea371, #0e7fa3); color: #04110c; }
  .btn.ghost { border: 1px solid var(--line); color: var(--text); background: var(--card); }

  footer { margin-top: 72px; padding-top: 22px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; color: var(--muted); font-size: 13.5px; }
  a { color: var(--cyan); text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <span class="pulse"><span class="dot"></span> all systems operational</span>
    <span class="mono" style="font-size:13px;color:var(--muted)">file TF-007 · license to act</span>
  </header>

  <div class="badge">The Agent Harness Hackathon · WeMakeDevs × TrueFoundry × Qodo · Aug 24–30 2026</div>

  <h1><span class="grad">RepoMedic</span> <span class="steth">🩺</span></h1>
  <p class="tagline">
    An autonomous open-source repository triage agent. It reads your repos
    <b>fearlessly</b>, verifies what it finds in a sandbox — and refuses to file
    a single issue until a human says <b>Allow</b>. Built on
    <a href="https://github.com/truefoundry/trueforge">TrueForge</a>, the open-source agent harness.
  </p>

  <div class="stats">
    <div class="stat"><div class="n">10</div><div class="l">MCP tools</div></div>
    <div class="stat"><div class="n">4</div><div class="l">safety layers</div></div>
    <div class="stat"><div class="n">23</div><div class="l">tests, all green</div></div>
    <div class="stat"><div class="n">800+</div><div class="l">PRs behind the idea</div></div>
  </div>

  <section>
    <h2>The tool belt</h2>
    <div class="grid">
      <div class="tool"><span class="free">read-only</span><code>repo_health_check</code><span>composite snapshot of issues, CI & README</span></div>
      <div class="tool"><span class="free">read-only</span><code>list_stale_issues</code><span>untouched issues, PRs filtered out</span></div>
      <div class="tool"><span class="free">read-only</span><code>check_readme_links</code><span>HEAD→GET link verification</span></div>
      <div class="tool"><span class="free">read-only</span><code>get_ci_status</code><span>recent workflow runs</span></div>
      <div class="tool"><span class="free">read-only</span><code>classify_ci_failures</code><span>flaky vs broken, with step evidence</span></div>
      <div class="tool"><span class="free">read-only</span><code>audit_dependencies</code><span>deprecated & majors-behind via npm registry</span></div>
      <div class="tool"><span class="free">read-only</span><code>check_community_health</code><span>LICENSE · CONTRIBUTING · CoC scoring</span></div>
      <div class="tool"><span class="free">read-only</span><code>search_similar_issues</code><span>dedupe before filing anything new</span></div>
      <div class="tool locked"><span class="lock">🔒 needs Allow</span><code>file_issue</code><span>opens an issue — turn freezes first</span></div>
      <div class="tool locked"><span class="lock">🔒 needs Allow</span><code>post_comment</code><span>comments on an issue — turn freezes first</span></div>
    </div>
  </section>

  <section>
    <h2>Safety, four ways</h2>
    <ol class="layers">
      <li><b>MCP annotations</b><small>writers declare destructiveHint — scanners declare readOnlyHint</small></li>
      <li><b>Human checkpoints</b><small>TrueForge pauses the entire turn until you pick Allow or Deny</small></li>
      <li><b>Server-side allow-list</b><small>writes outside REPOMEDIC_ALLOWED_REPOS are refused even if layers 1–2 fail</small></li>
      <li><b>Transport auth</b><small>every /mcp call requires the shared-secret header — 401 otherwise</small></li>
    </ol>
  </section>

  <section>
    <h2>The shape of it</h2>
    <div class="terminal">
      <div class="term-bar">
        <i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>
        <span class="mono dim" style="margin-left:8px;font-size:12px">repomedic — topology</span>
      </div>
      <pre>You ──chat──▶ <span class="c2">TrueForge harness</span> ──MCP──▶ <span class="c1">repomedic-tools</span> ──REST──▶ GitHub
                │  model loop              ├─ 8 scanners   <span class="dim">(run free)</span>
                │  subagents               └─ 2 writers    <span class="c3">(pause for Allow)</span>
                │  sandbox runs
                └─ approval gate ◀── <span class="c3">the whole point</span></pre>
    </div>
  </section>

  <div class="cta">
    <a class="btn primary" href="https://github.com/aniruddhaadak80/repomedic">★ View the source</a>
    <a class="btn ghost" href="/health">Health endpoint</a>
    <a class="btn ghost" href="https://www.wemakedevs.org/hackathons/trueforge">About the hackathon</a>
  </div>

  <footer>
    <span>Built solo by <a href="https://github.com/aniruddhaadak80">Aniruddha Adak</a> · AI-assisted development disclosed per rules</span>
    <span class="mono">MIT · v0.1.0</span>
  </footer>

</div>
</body>
</html>`;
