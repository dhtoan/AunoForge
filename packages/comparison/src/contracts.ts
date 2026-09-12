import {
  ValidationError,
  severities,
  validateFinding,
  validateReviewReport,
  type Finding,
  type ReviewReport,
  type Severity,
} from "@aunoforge/core";

export const incrementalStates = ["new", "persistent", "regressed"] as const;
export type IncrementalState = (typeof incrementalStates)[number];
export const regressionReasons = ["severity-increase", "returned"] as const;
export type RegressionReason = (typeof regressionReasons)[number];

export type ComparedFinding = {
  fingerprint: string;
  state: IncrementalState;
  finding: Finding;
  baselineSeverity?: Severity;
  regressionReason?: RegressionReason;
};

export type ResolvedFinding = {
  fingerprint: string;
  state: "resolved";
  finding: Finding;
};

export type IncrementalSummary = {
  new: number;
  persistent: number;
  resolved: number;
  regressed: number;
};

export type IncrementalReviewReport = {
  schemaVersion: "1";
  kind: "incremental-review";
  current: ReviewReport;
  findings: ComparedFinding[];
  resolved: ResolvedFinding[];
  summary: IncrementalSummary;
  resolvedFingerprints: string[];
};

export type BaselineReport = ReviewReport | IncrementalReviewReport;

const fingerprintPattern = /^af1:[a-f0-9]{64}$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
}

function assertFingerprint(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !fingerprintPattern.test(value)) {
    throw new ValidationError(`${label} must be an AunoForge af1 fingerprint`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ValidationError(`${label} must be a non-negative integer`);
  }
}

function validateSeverity(value: unknown, label: string): Severity {
  if (typeof value !== "string" || !severities.includes(value as Severity)) {
    throw new ValidationError(`${label} must be one of ${severities.join(", ")}`);
  }
  return value as Severity;
}

function validateComparedFinding(value: unknown, index: number): ComparedFinding {
  assertRecord(value, `findings[${index}]`);
  assertFingerprint(value.fingerprint, `findings[${index}].fingerprint`);
  if (typeof value.state !== "string" || !incrementalStates.includes(value.state as IncrementalState)) {
    throw new ValidationError(`findings[${index}].state must be one of ${incrementalStates.join(", ")}`);
  }
  const finding = validateFinding(value.finding);
  const compared: ComparedFinding = {
    fingerprint: value.fingerprint,
    state: value.state as IncrementalState,
    finding,
  };
  if (value.baselineSeverity !== undefined) {
    compared.baselineSeverity = validateSeverity(value.baselineSeverity, `findings[${index}].baselineSeverity`);
  }
  if (value.regressionReason !== undefined) {
    if (typeof value.regressionReason !== "string" || !regressionReasons.includes(value.regressionReason as RegressionReason)) {
      throw new ValidationError(`findings[${index}].regressionReason must be one of ${regressionReasons.join(", ")}`);
    }
    if (compared.state !== "regressed") {
      throw new ValidationError(`findings[${index}].regressionReason is only valid for regressed findings`);
    }
    compared.regressionReason = value.regressionReason as RegressionReason;
  }
  return compared;
}

function validateResolvedFinding(value: unknown, index: number): ResolvedFinding {
  assertRecord(value, `resolved[${index}]`);
  assertFingerprint(value.fingerprint, `resolved[${index}].fingerprint`);
  if (value.state !== "resolved") throw new ValidationError(`resolved[${index}].state must be resolved`);
  return {
    fingerprint: value.fingerprint,
    state: "resolved",
    finding: validateFinding(value.finding),
  };
}

function validateIncrementalSummary(value: unknown): IncrementalSummary {
  assertRecord(value, "summary");
  for (const key of ["new", "persistent", "resolved", "regressed"] as const) {
    assertNonNegativeInteger(value[key], `summary.${key}`);
  }
  return {
    new: value.new as number,
    persistent: value.persistent as number,
    resolved: value.resolved as number,
    regressed: value.regressed as number,
  };
}

function validateIncrementalReviewReport(input: Record<string, unknown>): IncrementalReviewReport {
  if (input.schemaVersion !== "1") throw new ValidationError("schemaVersion must be 1");
  if (input.kind !== "incremental-review") throw new ValidationError("kind must be incremental-review");
  const current = validateReviewReport(input.current);
  if (!Array.isArray(input.findings)) throw new ValidationError("findings must be an array");
  if (!Array.isArray(input.resolved)) throw new ValidationError("resolved must be an array");
  if (!Array.isArray(input.resolvedFingerprints)) throw new ValidationError("resolvedFingerprints must be an array");

  const findings = input.findings.map(validateComparedFinding);
  const resolved = input.resolved.map(validateResolvedFinding);
  const summary = validateIncrementalSummary(input.summary);
  const resolvedFingerprints = input.resolvedFingerprints.map((value, index) => {
    assertFingerprint(value, `resolvedFingerprints[${index}]`);
    return value;
  });
  if (new Set(resolvedFingerprints).size !== resolvedFingerprints.length) {
    throw new ValidationError("resolvedFingerprints must not contain duplicates");
  }

  const counted = {
    new: findings.filter((item) => item.state === "new").length,
    persistent: findings.filter((item) => item.state === "persistent").length,
    resolved: resolved.length,
    regressed: findings.filter((item) => item.state === "regressed").length,
  };
  for (const key of ["new", "persistent", "resolved", "regressed"] as const) {
    if (summary[key] !== counted[key]) {
      throw new ValidationError(`summary.${key} must match incremental findings`);
    }
  }

  return {
    schemaVersion: "1",
    kind: "incremental-review",
    current,
    findings,
    resolved,
    summary,
    resolvedFingerprints: [...resolvedFingerprints].sort(),
  };
}

export function validateBaselineReport(input: unknown): BaselineReport {
  assertRecord(input, "baseline report");
  if (input.kind === "incremental-review") return validateIncrementalReviewReport(input);
  return validateReviewReport(input);
}
