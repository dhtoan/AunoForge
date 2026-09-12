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
  allowWrite: allowWrite2
}) {
  const { verified, unverified } = getFindingVerificationCounts(report2);
  const mode = commentEnabled && allowWrite2 ? "PR comment write enabled" : "read-only";
  const severity = report2.summary;
  return [
    "## AunoForge Review",
    "",
    "| Field | Result |",
    "| --- | --- |",
    `| Recommendation | \`${report2.recommendation}\` |`,
    `| Provider | \`${provider2}\` |`,
    `| Format | \`${format2}\` |`,
    `| Mode | \`${mode}\` |`,
    `| Findings | ${verified} verified \xB7 ${unverified} unverified |`,
    `| Severity | Critical ${severity.critical} \xB7 High ${severity.high} \xB7 Medium ${severity.medium} \xB7 Low ${severity.low} \xB7 Info ${severity.info} |`,
    `| Report | \`${basename(reportPath2)}\` |`,
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
var comment = (process.env.INPUT_COMMENT || "false").toLowerCase() === "true";
var allowWrite = (process.env.INPUT_ALLOW_WRITE || "false").toLowerCase() === "true";
if (command !== "review") throw new Error("AunoForge Action supports command=review only.");
if (comment && !allowWrite) throw new Error("comment=true requires allow-write=true and pull-requests: write permission.");
if (!["mock", "codex", "claude"].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
if (!["terminal", "markdown", "json"].includes(format)) throw new Error(`Unsupported format: ${format}`);
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
if (Number.isInteger(prNumber) && prNumber > 0 && owner && repo) args.push("--pr", String(prNumber), "--owner", owner, "--repo", repo);
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
var rawReport = await runNode(args);
var structuredReport = validateReviewReport(JSON.parse(rawReport));
var report = format === "json" ? renderJson(structuredReport) : format === "markdown" ? renderMarkdown(structuredReport) : renderTerminal(structuredReport);
process.stdout.write(report);
var extension = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
var reportPath = join(workspace, `aunoforge-review.${extension}`);
await writeFile(reportPath, report, "utf8");
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report-path=${reportPath}
`, "utf8");
if (process.env.GITHUB_STEP_SUMMARY) {
  const stepSummary = renderActionStepSummary({
    report: structuredReport,
    provider,
    format,
    reportPath,
    commentEnabled: comment,
    allowWrite
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, "utf8");
}
if (comment) {
  if (!Number.isInteger(prNumber) || prNumber < 1 || !owner || !repo) throw new Error("PR comment mode requires a pull_request event.");
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("PR comment mode requires GITHUB_TOKEN.");
  const body = format === "markdown" ? report : `\`\`\`${format}
${report}
\`\`\``;
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ body })
  });
  if (!response.ok) throw new Error(`GitHub comment API returned ${response.status}`);
}
