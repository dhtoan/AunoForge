import type { Finding, ReviewReport, Severity } from "@aunoforge/core";
import type {
  BaselineReport,
  ComparedFinding,
  IncrementalReviewReport,
  ResolvedFinding,
} from "./contracts.js";
import { fingerprintFinding, normalizeFindingPath } from "./fingerprint.js";

const severityRank: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const stateRank = {
  regressed: 0,
  new: 1,
  persistent: 2,
} as const;

function strongerFinding(candidate: Finding, existing: Finding): boolean {
  const severityDifference = severityRank[candidate.severity] - severityRank[existing.severity];
  if (severityDifference !== 0) return severityDifference > 0;
  return candidate.id.localeCompare(existing.id) < 0;
}

function canonicalize(findings: Finding[]): Map<string, Finding> {
  const result = new Map<string, Finding>();
  for (const finding of findings) {
    const fingerprint = fingerprintFinding(finding);
    const existing = result.get(fingerprint);
    if (!existing || strongerFinding(finding, existing)) result.set(fingerprint, finding);
  }
  return result;
}

function isIncrementalReviewReport(baseline: BaselineReport): baseline is IncrementalReviewReport {
  return "kind" in baseline && baseline.kind === "incremental-review";
}

function baselineCurrent(baseline: BaselineReport): ReviewReport {
  return isIncrementalReviewReport(baseline) ? baseline.current : baseline;
}

function previousResolvedFingerprints(baseline: BaselineReport): Set<string> {
  return isIncrementalReviewReport(baseline) ? new Set(baseline.resolvedFingerprints) : new Set();
}

function findingLine(finding: Finding): number {
  return finding.location?.startLine ?? Number.MAX_SAFE_INTEGER;
}

function compareCurrent(a: ComparedFinding, b: ComparedFinding): number {
  return stateRank[a.state] - stateRank[b.state]
    || severityRank[b.finding.severity] - severityRank[a.finding.severity]
    || normalizeFindingPath(a.finding.location?.file).localeCompare(normalizeFindingPath(b.finding.location?.file))
    || findingLine(a.finding) - findingLine(b.finding)
    || a.fingerprint.localeCompare(b.fingerprint);
}

function compareResolved(a: ResolvedFinding, b: ResolvedFinding): number {
  return normalizeFindingPath(a.finding.location?.file).localeCompare(normalizeFindingPath(b.finding.location?.file))
    || findingLine(a.finding) - findingLine(b.finding)
    || a.fingerprint.localeCompare(b.fingerprint);
}

export function compareReviewReports(baseline: BaselineReport, current: ReviewReport): IncrementalReviewReport {
  const baselineFindings = canonicalize(baselineCurrent(baseline).findings);
  const currentFindings = canonicalize(current.findings);
  const priorResolved = previousResolvedFingerprints(baseline);
  const findings: ComparedFinding[] = [];

  for (const [fingerprint, finding] of currentFindings) {
    const previous = baselineFindings.get(fingerprint);
    if (previous) {
      if (severityRank[finding.severity] > severityRank[previous.severity]) {
        findings.push({
          fingerprint,
          state: "regressed",
          finding,
          baselineSeverity: previous.severity,
          regressionReason: "severity-increase",
        });
      } else {
        findings.push({
          fingerprint,
          state: "persistent",
          finding,
          baselineSeverity: previous.severity,
        });
      }
      continue;
    }
    if (priorResolved.has(fingerprint)) {
      findings.push({ fingerprint, state: "regressed", finding, regressionReason: "returned" });
      continue;
    }
    findings.push({ fingerprint, state: "new", finding });
  }

  const resolved: ResolvedFinding[] = [];
  for (const [fingerprint, finding] of baselineFindings) {
    if (!currentFindings.has(fingerprint)) resolved.push({ fingerprint, state: "resolved", finding });
  }

  const resolvedFingerprints = new Set(priorResolved);
  for (const item of resolved) resolvedFingerprints.add(item.fingerprint);
  for (const fingerprint of currentFindings.keys()) resolvedFingerprints.delete(fingerprint);

  findings.sort(compareCurrent);
  resolved.sort(compareResolved);

  return {
    schemaVersion: "1",
    kind: "incremental-review",
    current,
    findings,
    resolved,
    summary: {
      new: findings.filter((item) => item.state === "new").length,
      persistent: findings.filter((item) => item.state === "persistent").length,
      resolved: resolved.length,
      regressed: findings.filter((item) => item.state === "regressed").length,
    },
    resolvedFingerprints: [...resolvedFingerprints].sort(),
  };
}
