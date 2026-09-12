import type { ReviewReport } from "@aunoforge/core";

export function renderMarkdown(report: ReviewReport): string {
  const lines = [
    `# AunoForge Review`,
    "",
    `Recommendation: **${report.recommendation}**`,
    "",
    `Critical: ${report.summary.critical} · High: ${report.summary.high} · Medium: ${report.summary.medium} · Low: ${report.summary.low} · Info: ${report.summary.info}`,
    ""
  ];
  if (report.findings.length === 0) lines.push("No findings.", "");
  for (const finding of report.findings) {
    lines.push(`## ${finding.severity.toUpperCase()} · ${finding.title}`);
    lines.push(`Category: ${finding.category}`);
    lines.push(`Source: ${finding.source}`);
    lines.push(`Confidence: ${finding.confidence}`);
    if (finding.location) {
      const range = finding.location.startLine ? `:${finding.location.startLine}${finding.location.endLine && finding.location.endLine !== finding.location.startLine ? `-${finding.location.endLine}` : ""}` : "";
      lines.push(`Location: ${finding.location.file}${range}${finding.location.verified ? " (verified)" : " (unverified)"}`);
    }
    lines.push("", finding.explanation);
    if (finding.evidence.length) lines.push("", "Evidence:", ...finding.evidence.map((e) => `- ${e}`));
    if (finding.verification?.length) lines.push("", "Verification:", ...finding.verification.map((e) => `- ${e}`));
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
