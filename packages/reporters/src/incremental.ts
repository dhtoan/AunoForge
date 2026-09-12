import type { ComparedFinding, IncrementalReviewReport } from "@aunoforge/comparison";

function locationText(item: ComparedFinding): string {
  const location = item.finding.location;
  if (!location) return "repository";
  const end = location.endLine && location.endLine !== location.startLine ? `-${location.endLine}` : "";
  return `${location.file}:${location.startLine}${end}`;
}

function regressionSuffix(item: ComparedFinding): string {
  if (item.state !== "regressed" || !item.regressionReason) return "";
  if (item.regressionReason === "severity-increase" && item.baselineSeverity) {
    return ` · severity ${item.baselineSeverity} → ${item.finding.severity}`;
  }
  return " · returned after resolution";
}

export function renderIncrementalJson(report: IncrementalReviewReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderIncrementalMarkdown(report: IncrementalReviewReport): string {
  const lines = [
    "# AunoForge Incremental Review",
    "",
    `Recommendation: **${report.current.recommendation}**`,
    "",
    `Regressed: ${report.summary.regressed} · New: ${report.summary.new} · Persistent: ${report.summary.persistent} · Resolved: ${report.summary.resolved}`,
    "",
  ];

  for (const state of ["regressed", "new", "persistent"] as const) {
    const items = report.findings.filter((item) => item.state === state);
    if (items.length === 0) continue;
    lines.push(`## ${state.toUpperCase()} (${items.length})`, "");
    for (const item of items) {
      lines.push(`### ${item.finding.severity.toUpperCase()} · ${item.finding.title}`);
      lines.push(`Category: ${item.finding.category}`);
      lines.push(`Fingerprint: ${item.fingerprint}`);
      lines.push(`Location: ${locationText(item)}${regressionSuffix(item)}`);
      lines.push("", item.finding.explanation);
      if (item.finding.evidence.length) lines.push("", "Evidence:", ...item.finding.evidence.map((entry) => `- ${entry}`));
      lines.push("");
    }
  }

  lines.push(`## RESOLVED (${report.summary.resolved})`, "");
  if (report.resolved.length === 0) {
    lines.push("No resolved findings.", "");
  } else {
    for (const item of report.resolved) {
      const location = item.finding.location;
      const where = location ? `${location.file}:${location.startLine}` : "repository";
      lines.push(`- ${item.finding.title} · ${where} · ${item.fingerprint}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderIncrementalTerminal(report: IncrementalReviewReport): string {
  const lines = [
    "AunoForge Incremental Review",
    `Recommendation: ${report.current.recommendation}`,
    `Regressed: ${report.summary.regressed} · New: ${report.summary.new} · Persistent: ${report.summary.persistent} · Resolved: ${report.summary.resolved}`,
  ];

  for (const state of ["regressed", "new", "persistent"] as const) {
    for (const item of report.findings.filter((candidate) => candidate.state === state)) {
      lines.push(
        `[${state.toUpperCase()}][${item.finding.severity.toUpperCase()}] ${item.finding.title} — ${locationText(item)}${regressionSuffix(item)}`,
      );
    }
  }
  if (report.resolved.length > 0) {
    lines.push(`Resolved: ${report.resolved.length}`);
    for (const item of report.resolved) lines.push(`[RESOLVED] ${item.finding.title} — ${item.fingerprint}`);
  } else {
    lines.push("Resolved: 0");
  }
  return `${lines.join("\n")}\n`;
}
