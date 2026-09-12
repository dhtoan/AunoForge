import type { ReviewReport } from "@aunoforge/core";
export function renderTerminal(report: ReviewReport): string {
  const lines = [`AunoForge Review — ${report.recommendation}`];
  for (const finding of report.findings) {
    const location = finding.location ? ` (${finding.location.file}${finding.location.startLine ? `:${finding.location.startLine}` : ""})` : "";
    lines.push(`${finding.severity.toUpperCase()} ${finding.title}${location}`);
  }
  if (report.findings.length === 0) lines.push("No findings.");
  return lines.join("\n") + "\n";
}
