import type { Finding, ReviewReport, Severity } from "@aunoforge/core";

const severityRank: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export type GitHubAnnotationLevel = "error" | "warning" | "notice";

export type GitHubAnnotation = {
  level: GitHubAnnotationLevel;
  file: string;
  line: number;
  endLine: number;
  title: string;
  message: string;
  findingId: string;
};

export type GitHubAnnotationSelection = {
  annotations: GitHubAnnotation[];
  eligible: number;
  overflow: number;
};

export type GitHubAnnotationOptions = {
  minimumSeverity?: Severity;
  limit?: number;
};

function stableFile(file: string): string {
  return file.replace(/\\/g, "/");
}

export function parseChangedLineScope(diff: string): Map<string, Set<number>> {
  const scope = new Map<string, Set<number>>();
  let file: string | undefined;
  let newLine: number | undefined;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      file = target === "/dev/null"
        ? undefined
        : stableFile(target.startsWith("b/") ? target.slice(2) : target);
      if (file && !scope.has(file)) scope.set(file, new Set());
      newLine = undefined;
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }

    if (!file || newLine === undefined) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      scope.get(file)!.add(newLine);
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) continue;
    if (line.startsWith(" ")) {
      newLine += 1;
    }
  }

  return scope;
}

function annotationLevel(severity: Severity): GitHubAnnotationLevel {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "notice";
}

function isVerifiedLocation(finding: Finding): finding is Finding & {
  location: { file: string; startLine: number; endLine?: number; verified: true };
} {
  return finding.location?.verified === true
    && Number.isInteger(finding.location.startLine)
    && (finding.location.startLine ?? 0) > 0;
}

function firstChangedLine(finding: Finding & { location: { file: string; startLine: number; endLine?: number } }, scope: Map<string, Set<number>>): number | undefined {
  const lines = scope.get(stableFile(finding.location.file));
  if (!lines) return undefined;
  const start = finding.location.startLine;
  const end = Math.max(start, finding.location.endLine ?? start);
  return [...lines].filter((line) => line >= start && line <= end).sort((a, b) => a - b)[0];
}

export function selectGitHubAnnotations(
  report: ReviewReport,
  diff: string,
  options: GitHubAnnotationOptions = {},
): GitHubAnnotationSelection {
  const minimumSeverity = options.minimumSeverity ?? "medium";
  const limit = Math.max(0, options.limit ?? 25);
  const scope = parseChangedLineScope(diff);

  const eligible = report.findings.flatMap((finding) => {
    if (!isVerifiedLocation(finding)) return [];
    if (severityRank[finding.severity] < severityRank[minimumSeverity]) return [];
    const line = firstChangedLine(finding, scope);
    if (line === undefined) return [];
    return [{ finding, line, file: stableFile(finding.location.file) }];
  }).sort((a, b) =>
    severityRank[b.finding.severity] - severityRank[a.finding.severity]
      || a.file.localeCompare(b.file)
      || a.line - b.line
      || a.finding.category.localeCompare(b.finding.category)
      || a.finding.id.localeCompare(b.finding.id)
  );

  const annotations = eligible.slice(0, limit).map(({ finding, line, file }) => ({
    level: annotationLevel(finding.severity),
    file,
    line,
    endLine: line,
    title: finding.title,
    message: finding.evidence[0]
      ? `${finding.explanation} Evidence: ${finding.evidence[0]}`
      : finding.explanation,
    findingId: finding.id,
  }));

  return {
    annotations,
    eligible: eligible.length,
    overflow: Math.max(0, eligible.length - annotations.length),
  };
}
