// scripts/action.mjs
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// packages/core/dist/contracts.js
var severities = ["critical", "high", "medium", "low", "info"];
var findingSources = ["deterministic", "model", "hybrid"];
var recommendations = ["approve", "needs-review", "request-changes"];
var ValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};
function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError(`${label} must be an object`);
}
function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0)
    throw new ValidationError(`${label} must be a non-empty string`);
}
function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new ValidationError(`${label} must be an array of strings`);
}
function assertNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ValidationError(`${label} must be a finite number`);
}
function enumValue(value, allowed, label) {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new ValidationError(`${label} must be one of ${allowed.join(", ")}`);
  return value;
}
function validateFinding(input) {
  assertRecord(input, "finding");
  assertString(input.id, "id");
  const severity = enumValue(input.severity, severities, "severity");
  assertString(input.category, "category");
  assertString(input.title, "title");
  assertStringArray(input.evidence, "evidence");
  assertString(input.explanation, "explanation");
  assertNumber(input.confidence, "confidence");
  if (input.confidence < 0 || input.confidence > 1)
    throw new ValidationError("confidence must be between 0 and 1");
  const source = enumValue(input.source, findingSources, "source");
  let location;
  if (input.location !== void 0) {
    assertRecord(input.location, "location");
    assertString(input.location.file, "location.file");
    const startLine = input.location.startLine;
    const endLine = input.location.endLine;
    if (startLine !== void 0 && (!Number.isInteger(startLine) || startLine < 1))
      throw new ValidationError("location.startLine must be a positive integer");
    if (endLine !== void 0 && (!Number.isInteger(endLine) || endLine < 1))
      throw new ValidationError("location.endLine must be a positive integer");
    if (input.location.verified !== void 0 && typeof input.location.verified !== "boolean")
      throw new ValidationError("location.verified must be boolean");
    location = { file: input.location.file };
    if (startLine !== void 0)
      location.startLine = startLine;
    if (endLine !== void 0)
      location.endLine = endLine;
    if (input.location.verified !== void 0)
      location.verified = input.location.verified;
  }
  let verification;
  if (input.verification !== void 0) {
    assertStringArray(input.verification, "verification");
    verification = input.verification;
  }
  return {
    id: input.id,
    severity,
    category: input.category,
    title: input.title,
    evidence: input.evidence,
    ...location ? { location } : {},
    explanation: input.explanation,
    ...verification ? { verification } : {},
    confidence: input.confidence,
    source
  };
}
function validateSummary(input) {
  assertRecord(input, "summary");
  const summary = {};
  for (const key of severities) {
    const value = input[key];
    if (!Number.isInteger(value) || value < 0)
      throw new ValidationError(`summary.${key} must be a non-negative integer`);
    summary[key] = value;
  }
  return summary;
}
function validateReviewReport(input) {
  assertRecord(input, "review report");
  if (input.schemaVersion !== "1")
    throw new ValidationError("schemaVersion must be 1");
  assertRecord(input.repository, "repository");
  assertString(input.repository.root, "repository.root");
  if (!Array.isArray(input.findings))
    throw new ValidationError("findings must be an array");
  const findings = input.findings.map(validateFinding);
  const summary = validateSummary(input.summary);
  const recommendation = enumValue(input.recommendation, recommendations, "recommendation");
  const repository2 = { root: input.repository.root };
  for (const key of ["owner", "repo", "url", "ref"]) {
    const value = input.repository[key];
    if (value !== void 0) {
      assertString(value, `repository.${key}`);
      repository2[key] = value;
    }
  }
  return { schemaVersion: "1", repository: repository2, findings, summary, recommendation };
}

// packages/comparison/dist/fingerprint.js
import { createHash } from "node:crypto";
function normalizeFindingPath(value) {
  if (!value)
    return "<repository>";
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").trim();
  return normalized || "<repository>";
}
function normalizeEvidenceValue(value) {
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim().replace(/[\t ]+/g, " ")).filter(Boolean).join("\n");
}
function normalizeEvidenceAnchor(finding) {
  const evidence = [...new Set(finding.evidence.map(normalizeEvidenceValue).filter(Boolean))].sort();
  if (evidence.length > 0)
    return `evidence:${evidence.join("\n")}`;
  const start = finding.location?.startLine;
  if (Number.isInteger(start) && (start ?? 0) > 0) {
    const end = Math.max(start, finding.location?.endLine ?? start);
    return `line:${start}-${end}`;
  }
  return "global";
}
function fingerprintFinding(finding) {
  const semantic = [
    normalizeFindingPath(finding.location?.file),
    finding.category.trim().toLowerCase(),
    normalizeEvidenceAnchor(finding)
  ].join("\0");
  return `af1:${createHash("sha256").update(semantic, "utf8").digest("hex")}`;
}

// packages/comparison/dist/compare.js
var severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};
var stateRank = {
  regressed: 0,
  new: 1,
  persistent: 2
};
function strongerFinding(candidate, existing) {
  const severityDifference = severityRank[candidate.severity] - severityRank[existing.severity];
  if (severityDifference !== 0)
    return severityDifference > 0;
  return candidate.id.localeCompare(existing.id) < 0;
}
function canonicalize(findings) {
  const result = /* @__PURE__ */ new Map();
  for (const finding of findings) {
    const fingerprint = fingerprintFinding(finding);
    const existing = result.get(fingerprint);
    if (!existing || strongerFinding(finding, existing))
      result.set(fingerprint, finding);
  }
  return result;
}
function isIncrementalReviewReport(baseline2) {
  return "kind" in baseline2 && baseline2.kind === "incremental-review";
}
function baselineCurrent(baseline2) {
  return isIncrementalReviewReport(baseline2) ? baseline2.current : baseline2;
}
function previousResolvedFingerprints(baseline2) {
  return isIncrementalReviewReport(baseline2) ? new Set(baseline2.resolvedFingerprints) : /* @__PURE__ */ new Set();
}
function findingLine(finding) {
  return finding.location?.startLine ?? Number.MAX_SAFE_INTEGER;
}
function compareCurrent(a, b) {
  return stateRank[a.state] - stateRank[b.state] || severityRank[b.finding.severity] - severityRank[a.finding.severity] || normalizeFindingPath(a.finding.location?.file).localeCompare(normalizeFindingPath(b.finding.location?.file)) || findingLine(a.finding) - findingLine(b.finding) || a.fingerprint.localeCompare(b.fingerprint);
}
function compareResolved(a, b) {
  return normalizeFindingPath(a.finding.location?.file).localeCompare(normalizeFindingPath(b.finding.location?.file)) || findingLine(a.finding) - findingLine(b.finding) || a.fingerprint.localeCompare(b.fingerprint);
}
function compareReviewReports(baseline2, current) {
  const baselineFindings = canonicalize(baselineCurrent(baseline2).findings);
  const currentFindings = canonicalize(current.findings);
  const priorResolved = previousResolvedFingerprints(baseline2);
  const findings = [];
  for (const [fingerprint, finding] of currentFindings) {
    const previous = baselineFindings.get(fingerprint);
    if (previous) {
      if (severityRank[finding.severity] > severityRank[previous.severity]) {
        findings.push({
          fingerprint,
          state: "regressed",
          finding,
          baselineSeverity: previous.severity,
          regressionReason: "severity-increase"
        });
      } else {
        findings.push({
          fingerprint,
          state: "persistent",
          finding,
          baselineSeverity: previous.severity
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
  const resolved = [];
  for (const [fingerprint, finding] of baselineFindings) {
    if (!currentFindings.has(fingerprint))
      resolved.push({ fingerprint, state: "resolved", finding });
  }
  const resolvedFingerprints = new Set(priorResolved);
  for (const item of resolved)
    resolvedFingerprints.add(item.fingerprint);
  for (const fingerprint of currentFindings.keys())
    resolvedFingerprints.delete(fingerprint);
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
      regressed: findings.filter((item) => item.state === "regressed").length
    },
    resolvedFingerprints: [...resolvedFingerprints].sort()
  };
}

// packages/comparison/dist/contracts.js
var incrementalStates = ["new", "persistent", "regressed"];
var regressionReasons = ["severity-increase", "returned"];
var fingerprintPattern = /^af1:[a-f0-9]{64}$/;
function assertRecord2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
}
function assertFingerprint(value, label) {
  if (typeof value !== "string" || !fingerprintPattern.test(value)) {
    throw new ValidationError(`${label} must be an AunoForge af1 fingerprint`);
  }
}
function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative integer`);
  }
}
function validateSeverity(value, label) {
  if (typeof value !== "string" || !severities.includes(value)) {
    throw new ValidationError(`${label} must be one of ${severities.join(", ")}`);
  }
  return value;
}
function validateComparedFinding(value, index) {
  assertRecord2(value, `findings[${index}]`);
  assertFingerprint(value.fingerprint, `findings[${index}].fingerprint`);
  if (typeof value.state !== "string" || !incrementalStates.includes(value.state)) {
    throw new ValidationError(`findings[${index}].state must be one of ${incrementalStates.join(", ")}`);
  }
  const finding = validateFinding(value.finding);
  const compared = {
    fingerprint: value.fingerprint,
    state: value.state,
    finding
  };
  if (value.baselineSeverity !== void 0) {
    compared.baselineSeverity = validateSeverity(value.baselineSeverity, `findings[${index}].baselineSeverity`);
  }
  if (value.regressionReason !== void 0) {
    if (typeof value.regressionReason !== "string" || !regressionReasons.includes(value.regressionReason)) {
      throw new ValidationError(`findings[${index}].regressionReason must be one of ${regressionReasons.join(", ")}`);
    }
    if (compared.state !== "regressed") {
      throw new ValidationError(`findings[${index}].regressionReason is only valid for regressed findings`);
    }
    compared.regressionReason = value.regressionReason;
  }
  return compared;
}
function validateResolvedFinding(value, index) {
  assertRecord2(value, `resolved[${index}]`);
  assertFingerprint(value.fingerprint, `resolved[${index}].fingerprint`);
  if (value.state !== "resolved")
    throw new ValidationError(`resolved[${index}].state must be resolved`);
  return {
    fingerprint: value.fingerprint,
    state: "resolved",
    finding: validateFinding(value.finding)
  };
}
function validateIncrementalSummary(value) {
  assertRecord2(value, "summary");
  for (const key of ["new", "persistent", "resolved", "regressed"]) {
    assertNonNegativeInteger(value[key], `summary.${key}`);
  }
  return {
    new: value.new,
    persistent: value.persistent,
    resolved: value.resolved,
    regressed: value.regressed
  };
}
function validateIncrementalReviewReport(input) {
  if (input.schemaVersion !== "1")
    throw new ValidationError("schemaVersion must be 1");
  if (input.kind !== "incremental-review")
    throw new ValidationError("kind must be incremental-review");
  const current = validateReviewReport(input.current);
  if (!Array.isArray(input.findings))
    throw new ValidationError("findings must be an array");
  if (!Array.isArray(input.resolved))
    throw new ValidationError("resolved must be an array");
  if (!Array.isArray(input.resolvedFingerprints))
    throw new ValidationError("resolvedFingerprints must be an array");
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
    regressed: findings.filter((item) => item.state === "regressed").length
  };
  for (const key of ["new", "persistent", "resolved", "regressed"]) {
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
    resolvedFingerprints: [...resolvedFingerprints].sort()
  };
}
function validateBaselineReport(input) {
  assertRecord2(input, "baseline report");
  if (input.kind === "incremental-review")
    return validateIncrementalReviewReport(input);
  return validateReviewReport(input);
}

// packages/reporters/dist/markdown.js
function renderMarkdown(report2) {
  const lines = [
    `# AunoForge Review`,
    "",
    `Recommendation: **${report2.recommendation}**`,
    "",
    `Critical: ${report2.summary.critical} \xB7 High: ${report2.summary.high} \xB7 Medium: ${report2.summary.medium} \xB7 Low: ${report2.summary.low} \xB7 Info: ${report2.summary.info}`,
    ""
  ];
  if (report2.findings.length === 0)
    lines.push("No findings.", "");
  for (const finding of report2.findings) {
    lines.push(`## ${finding.severity.toUpperCase()} \xB7 ${finding.title}`);
    lines.push(`Category: ${finding.category}`);
    lines.push(`Source: ${finding.source}`);
    lines.push(`Confidence: ${finding.confidence}`);
    if (finding.location) {
      const range = finding.location.startLine ? `:${finding.location.startLine}${finding.location.endLine && finding.location.endLine !== finding.location.startLine ? `-${finding.location.endLine}` : ""}` : "";
      lines.push(`Location: ${finding.location.file}${range}${finding.location.verified ? " (verified)" : " (unverified)"}`);
    }
    lines.push("", finding.explanation);
    if (finding.evidence.length)
      lines.push("", "Evidence:", ...finding.evidence.map((e) => `- ${e}`));
    if (finding.verification?.length)
      lines.push("", "Verification:", ...finding.verification.map((e) => `- ${e}`));
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

// packages/reporters/dist/json.js
function renderJson(report2) {
  return JSON.stringify(validateReviewReport(report2), null, 2) + "\n";
}

// packages/reporters/dist/terminal.js
function renderTerminal(report2) {
  const lines = [`AunoForge Review \u2014 ${report2.recommendation}`];
  for (const finding of report2.findings) {
    const location = finding.location ? ` (${finding.location.file}${finding.location.startLine ? `:${finding.location.startLine}` : ""})` : "";
    lines.push(`${finding.severity.toUpperCase()} ${finding.title}${location}`);
  }
  if (report2.findings.length === 0)
    lines.push("No findings.");
  return lines.join("\n") + "\n";
}

// packages/reporters/dist/sarif.js
var severityRank2 = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};
function levelFor(severity) {
  if (severity === "critical" || severity === "high")
    return "error";
  if (severity === "medium")
    return "warning";
  return "note";
}
function verifiedLocation(finding) {
  return finding.location?.verified === true && Number.isInteger(finding.location.startLine) && (finding.location.startLine ?? 0) > 0;
}
function stableFile(file) {
  return file.replace(/\\/g, "/");
}
function compareResults(a, b) {
  return severityRank2[b.severity] - severityRank2[a.severity] || stableFile(a.location.file).localeCompare(stableFile(b.location.file)) || a.location.startLine - b.location.startLine || a.category.localeCompare(b.category) || a.id.localeCompare(b.id);
}
function renderSarif(report2, incremental2) {
  const eligible = report2.findings.filter(verifiedLocation).sort(compareResults);
  const categories = [...new Set(eligible.map((finding) => finding.category))].sort();
  const rules = categories.map((category) => {
    const finding = eligible.find((candidate) => candidate.category === category);
    return {
      id: category,
      name: category,
      shortDescription: { text: finding.title }
    };
  });
  const comparisonByFindingId = new Map(incremental2?.findings.map((item) => [item.finding.id, item]) ?? []);
  const comparisonByFingerprint = new Map(incremental2?.findings.map((item) => [item.fingerprint, item]) ?? []);
  const results = eligible.map((finding) => {
    const firstEvidence = finding.evidence[0];
    const message = firstEvidence ? `${finding.title} \u2014 ${firstEvidence}` : `${finding.title} \u2014 ${finding.explanation}`;
    const region = {
      startLine: finding.location.startLine
    };
    if (finding.location.endLine !== void 0)
      region.endLine = finding.location.endLine;
    const computedFingerprint = incremental2 ? fingerprintFinding(finding) : void 0;
    const compared = incremental2 ? comparisonByFindingId.get(finding.id) ?? (computedFingerprint ? comparisonByFingerprint.get(computedFingerprint) : void 0) : void 0;
    const incrementalProperties = compared ? { aunoforgeFingerprint: compared.fingerprint, aunoforgeState: compared.state } : {};
    return {
      ruleId: finding.category,
      level: levelFor(finding.severity),
      message: { text: message },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: stableFile(finding.location.file) },
          region
        }
      }],
      properties: {
        aunoforgeFindingId: finding.id,
        aunoforgeSource: finding.source,
        confidence: finding.confidence,
        evidence: finding.evidence,
        ...incrementalProperties
      }
    };
  });
  const run = {
    tool: { driver: { name: "AunoForge", rules } },
    results
  };
  if (incremental2)
    run.properties = { aunoforgeIncremental: incremental2.summary };
  return `${JSON.stringify({
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [run]
  }, null, 2)}
`;
}

// packages/reporters/dist/github.js
var severityRank3 = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};
function stableFile2(file) {
  return file.replace(/\\/g, "/");
}
function parseChangedLineScope(diff) {
  const scope = /* @__PURE__ */ new Map();
  let file;
  let newLine;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      file = target === "/dev/null" ? void 0 : stableFile2(target.startsWith("b/") ? target.slice(2) : target);
      if (file && !scope.has(file))
        scope.set(file, /* @__PURE__ */ new Set());
      newLine = void 0;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (!file || newLine === void 0)
      continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      scope.get(file).add(newLine);
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---"))
      continue;
    if (line.startsWith(" ")) {
      newLine += 1;
    }
  }
  return scope;
}
function annotationLevel(severity) {
  if (severity === "critical" || severity === "high")
    return "error";
  if (severity === "medium")
    return "warning";
  return "notice";
}
function isVerifiedLocation(finding) {
  return finding.location?.verified === true && Number.isInteger(finding.location.startLine) && (finding.location.startLine ?? 0) > 0;
}
function firstChangedLine(finding, scope) {
  const lines = scope.get(stableFile2(finding.location.file));
  if (!lines)
    return void 0;
  const start = finding.location.startLine;
  const end = Math.max(start, finding.location.endLine ?? start);
  return [...lines].filter((line) => line >= start && line <= end).sort((a, b) => a - b)[0];
}
function selectGitHubAnnotations(report2, diff, options = {}) {
  const minimumSeverity = options.minimumSeverity ?? "medium";
  const limit = Math.max(0, options.limit ?? 25);
  const scope = parseChangedLineScope(diff);
  const eligible = report2.findings.flatMap((finding) => {
    if (!isVerifiedLocation(finding))
      return [];
    if (severityRank3[finding.severity] < severityRank3[minimumSeverity])
      return [];
    const line = firstChangedLine(finding, scope);
    if (line === void 0)
      return [];
    return [{ finding, line, file: stableFile2(finding.location.file) }];
  }).sort((a, b) => severityRank3[b.finding.severity] - severityRank3[a.finding.severity] || a.file.localeCompare(b.file) || a.line - b.line || a.finding.category.localeCompare(b.finding.category) || a.finding.id.localeCompare(b.finding.id));
  const annotations = eligible.slice(0, limit).map(({ finding, line, file }) => ({
    level: annotationLevel(finding.severity),
    file,
    line,
    endLine: line,
    title: finding.title,
    message: finding.evidence[0] ? `${finding.explanation} Evidence: ${finding.evidence[0]}` : finding.explanation,
    findingId: finding.id
  }));
  return {
    annotations,
    eligible: eligible.length,
    overflow: Math.max(0, eligible.length - annotations.length)
  };
}

// packages/reporters/dist/incremental.js
function locationText(item) {
  const location = item.finding.location;
  if (!location)
    return "repository";
  const end = location.endLine && location.endLine !== location.startLine ? `-${location.endLine}` : "";
  return `${location.file}:${location.startLine}${end}`;
}
function regressionSuffix(item) {
  if (item.state !== "regressed" || !item.regressionReason)
    return "";
  if (item.regressionReason === "severity-increase" && item.baselineSeverity) {
    return ` \xB7 severity ${item.baselineSeverity} \u2192 ${item.finding.severity}`;
  }
  return " \xB7 returned after resolution";
}
function renderIncrementalJson(report2) {
  return `${JSON.stringify(report2, null, 2)}
`;
}
function renderIncrementalMarkdown(report2) {
  const lines = [
    "# AunoForge Incremental Review",
    "",
    `Recommendation: **${report2.current.recommendation}**`,
    "",
    `Regressed: ${report2.summary.regressed} \xB7 New: ${report2.summary.new} \xB7 Persistent: ${report2.summary.persistent} \xB7 Resolved: ${report2.summary.resolved}`,
    ""
  ];
  for (const state of ["regressed", "new", "persistent"]) {
    const items = report2.findings.filter((item) => item.state === state);
    if (items.length === 0)
      continue;
    lines.push(`## ${state.toUpperCase()} (${items.length})`, "");
    for (const item of items) {
      lines.push(`### ${item.finding.severity.toUpperCase()} \xB7 ${item.finding.title}`);
      lines.push(`Category: ${item.finding.category}`);
      lines.push(`Fingerprint: ${item.fingerprint}`);
      lines.push(`Location: ${locationText(item)}${regressionSuffix(item)}`);
      lines.push("", item.finding.explanation);
      if (item.finding.evidence.length)
        lines.push("", "Evidence:", ...item.finding.evidence.map((entry) => `- ${entry}`));
      lines.push("");
    }
  }
  lines.push(`## RESOLVED (${report2.summary.resolved})`, "");
  if (report2.resolved.length === 0) {
    lines.push("No resolved findings.", "");
  } else {
    for (const item of report2.resolved) {
      const location = item.finding.location;
      const where = location ? `${location.file}:${location.startLine}` : "repository";
      lines.push(`- ${item.finding.title} \xB7 ${where} \xB7 ${item.fingerprint}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}
`;
}
function renderIncrementalTerminal(report2) {
  const lines = [
    "AunoForge Incremental Review",
    `Recommendation: ${report2.current.recommendation}`,
    `Regressed: ${report2.summary.regressed} \xB7 New: ${report2.summary.new} \xB7 Persistent: ${report2.summary.persistent} \xB7 Resolved: ${report2.summary.resolved}`
  ];
  for (const state of ["regressed", "new", "persistent"]) {
    for (const item of report2.findings.filter((candidate) => candidate.state === state)) {
      lines.push(`[${state.toUpperCase()}][${item.finding.severity.toUpperCase()}] ${item.finding.title} \u2014 ${locationText(item)}${regressionSuffix(item)}`);
    }
  }
  if (report2.resolved.length > 0) {
    lines.push(`Resolved: ${report2.resolved.length}`);
    for (const item of report2.resolved)
      lines.push(`[RESOLVED] ${item.finding.title} \u2014 ${item.fingerprint}`);
  } else {
    lines.push("Resolved: 0");
  }
  return `${lines.join("\n")}
`;
}

// packages/reporters/dist/reporter.js
function renderReport(report2, format2, incremental2) {
  if (!incremental2) {
    if (format2 === "json")
      return renderJson(report2);
    if (format2 === "markdown")
      return renderMarkdown(report2);
    if (format2 === "sarif")
      return renderSarif(report2);
    return renderTerminal(report2);
  }
  if (format2 === "json")
    return renderIncrementalJson(incremental2);
  if (format2 === "markdown")
    return renderIncrementalMarkdown(incremental2);
  if (format2 === "sarif")
    return renderSarif(report2, incremental2);
  return renderIncrementalTerminal(incremental2);
}

// scripts/action-annotations.mjs
function escapeCommandProperty(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A").replaceAll(":", "%3A").replaceAll(",", "%2C");
}
function escapeCommandMessage(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}
function formatGitHubAnnotation(annotation) {
  const properties = [
    `file=${escapeCommandProperty(annotation.file)}`,
    `line=${annotation.line}`,
    `endLine=${annotation.endLine}`,
    `title=${escapeCommandProperty(annotation.title)}`
  ].join(",");
  return `::${annotation.level} ${properties}::${escapeCommandMessage(annotation.message)}
`;
}
function emitGitHubAnnotations(annotations, write = (chunk) => process.stdout.write(chunk)) {
  for (const annotation of annotations) {
    write(formatGitHubAnnotation(annotation));
  }
}

// scripts/action-summary.mjs
import { basename } from "node:path";
function getFindingVerificationCounts(report2) {
  let verified = 0;
  let unverified = 0;
  for (const finding of report2.findings) {
    if (finding.source === "deterministic" || finding.location?.verified === true) verified += 1;
    else unverified += 1;
  }
  return { verified, unverified };
}
function renderActionStepSummary({
  report: report2,
  provider: provider2,
  format: format2,
  reportPath: reportPath2,
  commentEnabled,
  allowWrite: allowWrite2,
  incrementalSummary,
  annotationSummary: annotationSummary2 = { eligible: 0, emitted: 0, overflow: 0 }
}) {
  const { verified, unverified } = getFindingVerificationCounts(report2);
  const mode = commentEnabled && allowWrite2 ? "PR comment write enabled" : "read-only";
  const severity = report2.summary;
  const rows = [
    `| Recommendation | \`${report2.recommendation}\` |`
  ];
  if (incrementalSummary) {
    rows.push(`| Incremental | New ${incrementalSummary.new} \xB7 Regressed ${incrementalSummary.regressed} \xB7 Persistent ${incrementalSummary.persistent} \xB7 Resolved ${incrementalSummary.resolved} |`);
  }
  rows.push(
    `| Provider | \`${provider2}\` |`,
    `| Format | \`${format2}\` |`,
    `| Mode | \`${mode}\` |`,
    `| Findings | ${verified} verified \xB7 ${unverified} unverified |`,
    `| Severity | Critical ${severity.critical} \xB7 High ${severity.high} \xB7 Medium ${severity.medium} \xB7 Low ${severity.low} \xB7 Info ${severity.info} |`,
    `| Annotations | ${annotationSummary2.emitted} emitted \xB7 ${annotationSummary2.overflow} overflow |`,
    `| Report | \`${basename(reportPath2)}\` |`
  );
  return [
    "## AunoForge Review",
    "",
    "| Field | Result |",
    "| --- | --- |",
    ...rows,
    "",
    "> Repository writes are disabled by default. PR comments require both `comment=true` and `allow-write=true` plus the required GitHub permission.",
    ""
  ].join("\n");
}

// scripts/action.mjs
var sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
var actionRoot = resolve(process.env.GITHUB_ACTION_PATH || sourceRoot);
var packagedCli = fileURLToPath(new URL("./cli.mjs", import.meta.url));
var cliPath = existsSync(packagedCli) ? packagedCli : join(actionRoot, "dist/action/cli.mjs");
var workspace = resolve(process.env.GITHUB_WORKSPACE || process.cwd());
var command = process.env.INPUT_COMMAND || "review";
var provider = process.env.INPUT_PROVIDER || "mock";
var model = process.env.INPUT_MODEL || "";
var format = process.env.INPUT_FORMAT || "markdown";
var baselineInput = process.env.INPUT_BASELINE || "";
var comment = (process.env.INPUT_COMMENT || "false").toLowerCase() === "true";
var allowWrite = (process.env.INPUT_ALLOW_WRITE || "false").toLowerCase() === "true";
var githubApiBase = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
if (command !== "review") throw new Error("AunoForge Action supports command=review only.");
if (comment && !allowWrite) throw new Error("comment=true requires allow-write=true and pull-requests: write permission.");
if (!["mock", "codex", "claude"].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
if (!["terminal", "markdown", "json", "sarif"].includes(format)) throw new Error(`Unsupported format: ${format}`);
var args = [cliPath, "review", "--root", workspace, "--provider", provider, "--format", "json"];
if (model) args.push("--model", model);
var eventPath = process.env.GITHUB_EVENT_PATH;
var event = {};
if (eventPath) {
  try {
    event = JSON.parse(await readFile(eventPath, "utf8"));
  } catch {
    event = {};
  }
}
var repository = process.env.GITHUB_REPOSITORY || "";
var [owner, repo] = repository.split("/");
var prNumber = Number(event?.pull_request?.number);
var hasPullRequestContext = Number.isInteger(prNumber) && prNumber > 0 && Boolean(owner) && Boolean(repo);
if (hasPullRequestContext) args.push("--pr", String(prNumber), "--owner", owner, "--repo", repo);
function runNode(argv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, argv, { cwd: workspace, env: process.env, stdio: ["ignore", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise(stdout) : reject(new Error(`AunoForge CLI exited with ${code}`)));
  });
}
function githubHeaders(accept) {
  const headers = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
async function fetchPullRequestDiff() {
  if (!hasPullRequestContext) return void 0;
  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
    method: "GET",
    headers: githubHeaders("application/vnd.github.v3.diff")
  });
  if (!response.ok) throw new Error(`GitHub diff API returned ${response.status}`);
  return response.text();
}
var rawReport = await runNode(args);
var structuredReport = validateReviewReport(JSON.parse(rawReport));
var baseline = baselineInput ? validateBaselineReport(JSON.parse(await readFile(resolve(workspace, baselineInput), "utf8"))) : void 0;
var incremental = baseline ? compareReviewReports(baseline, structuredReport) : void 0;
var report = renderReport(structuredReport, format, incremental);
process.stdout.write(report);
var extension = format === "json" ? "json" : format === "markdown" ? "md" : format === "sarif" ? "sarif" : "txt";
var reportPath = join(workspace, `aunoforge-review.${extension}`);
await writeFile(reportPath, report, "utf8");
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report-path=${reportPath}
`, "utf8");
var annotationSummary = { eligible: 0, emitted: 0, overflow: 0 };
if (hasPullRequestContext) {
  try {
    const diff = await fetchPullRequestDiff();
    if (diff !== void 0) {
      const annotationReport = incremental ? {
        ...structuredReport,
        findings: incremental.findings.filter((item) => item.state === "new" || item.state === "regressed").map((item) => item.finding)
      } : structuredReport;
      const selection = selectGitHubAnnotations(annotationReport, diff);
      emitGitHubAnnotations(selection.annotations);
      annotationSummary = {
        eligible: selection.eligible,
        emitted: selection.annotations.length,
        overflow: selection.overflow
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`AunoForge annotations skipped: ${message}
`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const stepSummary = renderActionStepSummary({
    report: structuredReport,
    provider,
    format,
    reportPath,
    commentEnabled: comment,
    allowWrite,
    incrementalSummary: incremental?.summary,
    annotationSummary
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, "utf8");
}
if (comment) {
  if (!hasPullRequestContext) throw new Error("PR comment mode requires a pull_request event.");
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("PR comment mode requires GITHUB_TOKEN.");
  const body = format === "markdown" ? report : `\`\`\`${format}
${report}
\`\`\``;
  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      ...githubHeaders("application/vnd.github+json"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ body })
  });
  if (!response.ok) throw new Error(`GitHub comment API returned ${response.status}`);
}
