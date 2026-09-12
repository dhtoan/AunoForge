import type { Finding, ReviewReport, Severity } from "@aunoforge/core";

const severityRank: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function levelFor(severity: Severity): "error" | "warning" | "note" {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "note";
}

function verifiedLocation(finding: Finding): finding is Finding & {
  location: { file: string; startLine: number; endLine?: number; verified: true };
} {
  return finding.location?.verified === true
    && Number.isInteger(finding.location.startLine)
    && (finding.location.startLine ?? 0) > 0;
}

function stableFile(file: string): string {
  return file.replace(/\\/g, "/");
}

function compareResults(a: Finding & { location: { file: string; startLine: number } }, b: Finding & { location: { file: string; startLine: number } }): number {
  return severityRank[b.severity] - severityRank[a.severity]
    || stableFile(a.location.file).localeCompare(stableFile(b.location.file))
    || a.location.startLine - b.location.startLine
    || a.category.localeCompare(b.category)
    || a.id.localeCompare(b.id);
}

export function renderSarif(report: ReviewReport): string {
  const eligible = report.findings.filter(verifiedLocation).sort(compareResults);
  const categories = [...new Set(eligible.map((finding) => finding.category))].sort();
  const rules = categories.map((category) => {
    const finding = eligible.find((candidate) => candidate.category === category)!;
    return {
      id: category,
      name: category,
      shortDescription: { text: finding.title },
    };
  });

  const results = eligible.map((finding) => {
    const firstEvidence = finding.evidence[0];
    const message = firstEvidence
      ? `${finding.title} — ${firstEvidence}`
      : `${finding.title} — ${finding.explanation}`;
    const region: { startLine: number; endLine?: number } = {
      startLine: finding.location.startLine,
    };
    if (finding.location.endLine !== undefined) region.endLine = finding.location.endLine;

    return {
      ruleId: finding.category,
      level: levelFor(finding.severity),
      message: { text: message },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: stableFile(finding.location.file) },
          region,
        },
      }],
      properties: {
        aunoforgeFindingId: finding.id,
        aunoforgeSource: finding.source,
        confidence: finding.confidence,
        evidence: finding.evidence,
      },
    };
  });

  return `${JSON.stringify({
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "AunoForge", rules } },
      results,
    }],
  }, null, 2)}\n`;
}
