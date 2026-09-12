export const severities = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof severities)[number];
export const findingSources = ["deterministic", "model", "hybrid"] as const;
export type FindingSource = (typeof findingSources)[number];
export const recommendations = ["approve", "needs-review", "request-changes"] as const;
export type Recommendation = (typeof recommendations)[number];

export type FindingLocation = {
  file: string;
  startLine?: number;
  endLine?: number;
  verified?: boolean;
};

export type Finding = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  evidence: string[];
  location?: FindingLocation;
  explanation: string;
  verification?: string[];
  confidence: number;
  source: FindingSource;
};

export type RepositoryRef = {
  root: string;
  owner?: string;
  repo?: string;
  url?: string;
  ref?: string;
};

export type SeveritySummary = Record<Severity, number>;

export type ReviewReport = {
  schemaVersion: "1";
  repository: RepositoryRef;
  findings: Finding[];
  summary: SeveritySummary;
  recommendation: Recommendation;
};

export type AnalysisRequest = {
  task: string;
  systemPolicy: string;
  trustedMetadata: Record<string, unknown>;
  untrustedContent: Record<string, unknown>;
  checks?: string[];
  constraints?: Record<string, unknown>;
};

export type AnalysisResponse = {
  findings?: Finding[];
  data?: Record<string, unknown>;
};

export type GenerationRequest = AnalysisRequest & { outputKind: string };
export type GenerationResponse = { data: Record<string, unknown> };

export type TriageReport = {
  schemaVersion: "1";
  issue: { number: number; title: string; url?: string };
  type: string;
  component: string;
  severity: Severity;
  confidence: number;
  suggestedLabels: string[];
  duplicateCandidates: Array<{ number: number; title: string; url?: string }>;
  missingInformation: string[];
  nextAction: string;
};

export type ReproductionPlan = {
  schemaVersion: "1";
  issue: { number: number; title: string; url?: string };
  environment: string[];
  steps: string[];
  expected: string;
  actual: string;
  likelyAffectedAreas: string[];
  missingEvidence: string[];
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${label} must be an object`);
}
function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new ValidationError(`${label} must be a non-empty string`);
}
function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new ValidationError(`${label} must be an array of strings`);
}
function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ValidationError(`${label} must be a finite number`);
}
function enumValue<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new ValidationError(`${label} must be one of ${allowed.join(", ")}`);
  return value as T[number];
}

export function validateFinding(input: unknown): Finding {
  assertRecord(input, "finding");
  assertString(input.id, "id");
  const severity = enumValue(input.severity, severities, "severity");
  assertString(input.category, "category");
  assertString(input.title, "title");
  assertStringArray(input.evidence, "evidence");
  assertString(input.explanation, "explanation");
  assertNumber(input.confidence, "confidence");
  if (input.confidence < 0 || input.confidence > 1) throw new ValidationError("confidence must be between 0 and 1");
  const source = enumValue(input.source, findingSources, "source");

  let location: FindingLocation | undefined;
  if (input.location !== undefined) {
    assertRecord(input.location, "location");
    assertString(input.location.file, "location.file");
    const startLine = input.location.startLine;
    const endLine = input.location.endLine;
    if (startLine !== undefined && (!Number.isInteger(startLine) || (startLine as number) < 1)) throw new ValidationError("location.startLine must be a positive integer");
    if (endLine !== undefined && (!Number.isInteger(endLine) || (endLine as number) < 1)) throw new ValidationError("location.endLine must be a positive integer");
    if (input.location.verified !== undefined && typeof input.location.verified !== "boolean") throw new ValidationError("location.verified must be boolean");
    location = { file: input.location.file as string };
    if (startLine !== undefined) location.startLine = startLine as number;
    if (endLine !== undefined) location.endLine = endLine as number;
    if (input.location.verified !== undefined) location.verified = input.location.verified as boolean;
  }

  let verification: string[] | undefined;
  if (input.verification !== undefined) {
    assertStringArray(input.verification, "verification");
    verification = input.verification;
  }

  return {
    id: input.id,
    severity,
    category: input.category,
    title: input.title,
    evidence: input.evidence,
    ...(location ? { location } : {}),
    explanation: input.explanation,
    ...(verification ? { verification } : {}),
    confidence: input.confidence,
    source
  };
}

function validateSummary(input: unknown): SeveritySummary {
  assertRecord(input, "summary");
  const summary = {} as SeveritySummary;
  for (const key of severities) {
    const value = input[key];
    if (!Number.isInteger(value) || (value as number) < 0) throw new ValidationError(`summary.${key} must be a non-negative integer`);
    summary[key] = value as number;
  }
  return summary;
}

export function validateReviewReport(input: unknown): ReviewReport {
  assertRecord(input, "review report");
  if (input.schemaVersion !== "1") throw new ValidationError("schemaVersion must be 1");
  assertRecord(input.repository, "repository");
  assertString(input.repository.root, "repository.root");
  if (!Array.isArray(input.findings)) throw new ValidationError("findings must be an array");
  const findings = input.findings.map(validateFinding);
  const summary = validateSummary(input.summary);
  const recommendation = enumValue(input.recommendation, recommendations, "recommendation");
  const repository: RepositoryRef = { root: input.repository.root as string };
  for (const key of ["owner", "repo", "url", "ref"] as const) {
    const value = input.repository[key];
    if (value !== undefined) {
      assertString(value, `repository.${key}`);
      repository[key] = value;
    }
  }
  return { schemaVersion: "1", repository, findings, summary, recommendation };
}
