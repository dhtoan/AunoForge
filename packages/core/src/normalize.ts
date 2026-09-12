import { severities, type Finding, type RepositoryRef, type ReviewReport, type SeveritySummary } from "./contracts.js";

export function summarizeFindings(findings: Finding[]): SeveritySummary {
  const summary: SeveritySummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return summary;
}

export function normalizeReviewReport(repository: RepositoryRef, findings: Finding[]): ReviewReport {
  const summary = summarizeFindings(findings);
  const recommendation = summary.critical > 0 || summary.high > 0
    ? "request-changes"
    : summary.medium > 0
      ? "needs-review"
      : "approve";
  return { schemaVersion: "1", repository, findings, summary, recommendation };
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const output: Finding[] = [];
  for (const finding of findings) {
    const key = [finding.category, finding.location?.file ?? "", finding.location?.startLine ?? "", finding.title.trim().toLowerCase()].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      output.push(finding);
    }
  }
  return output;
}
