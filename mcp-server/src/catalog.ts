/**
 * Single source of truth for the tool inventory exposed at GET /tools.
 * Marketing copy on the landing page may be hand-written; this list is canonical.
 */
export interface ToolCatalogEntry {
  name: string;
  gate: "free" | "approval-required";
  description: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: "repo_health_check", gate: "free", description: "Composite snapshot: issues, staleness, CI conclusions, README presence" },
  { name: "list_stale_issues", gate: "free", description: "Open issues untouched for N days, PRs excluded" },
  { name: "check_readme_links", gate: "free", description: "Verify every http(s) link in the README; report dead ones" },
  { name: "get_ci_status", gate: "free", description: "Recent GitHub Actions runs with conclusions" },
  { name: "classify_ci_failures", gate: "free", description: "Flaky-vs-broken verdict per failing run with step evidence" },
  { name: "audit_dependencies", gate: "free", description: "Deprecated packages and majors-behind via npm registry" },
  { name: "check_community_health", gate: "free", description: "LICENSE/CONTRIBUTING/CoC/templates presence scoring" },
  { name: "search_similar_issues", gate: "free", description: "Issue search to prevent duplicate filing" },
  { name: "bus_factor", gate: "free", description: "Contribution concentration and maintenance-risk verdict" },
  { name: "release_health", gate: "free", description: "Drift since latest release: commits ahead, cadence verdict" },
  { name: "triage_priorities", gate: "free", description: "Flagship composite: severity-ranked action list across all scanners" },
  { name: "file_issue", gate: "approval-required", description: "Open an issue — harness pauses for human Allow/Deny" },
  { name: "post_comment", gate: "approval-required", description: "Comment on an issue — harness pauses for human Allow/Deny" },
];
