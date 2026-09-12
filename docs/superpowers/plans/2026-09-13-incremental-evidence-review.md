# Incremental Evidence Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic finding fingerprints and offline baseline comparison so AunoForge can classify evidence as `new`, `persistent`, `resolved`, or `regressed` without storing state remotely.

**Architecture:** Add a focused `@aunoforge/comparison` package that consumes validated `ReviewReport` snapshots and produces a self-contained `IncrementalReviewReport`. The comparison engine owns fingerprinting, baseline parsing, state transitions, and resolved-history tombstones; reporters only present comparison output, while CLI and Action integrations accept an explicit prior JSON file and preserve existing behavior when no baseline is supplied.

**Tech Stack:** TypeScript 5.x project references, Node.js built-in `node:crypto`, ESM, pnpm 10.15.1, Node test runner, checked-in Node 24 Action bundle via esbuild.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md`

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge.
- Read-only behavior remains the default.
- Any GitHub write requires explicit configuration and the minimum required permission.
- Fork-originated pull requests must never gain an implicit write path.
- Provider credentials are optional unless the user explicitly selects a network provider.
- Deterministic/mock mode remains a first-class zero-key path.
- Findings retain provenance: `deterministic`, `model`, or `hybrid`.
- Evidence validation remains mandatory before a model-derived file/line claim is treated as verified.
- Behavior-changing work uses test-first development where practical.
- Relevant lint, typecheck, tests, build, generated-runtime drift checks, platform smoke, and GitHub CI must pass before the milestone is called complete.
- Generated reports must be reproducible from the same repository state, configuration, and deterministic inputs, excluding inherently external provider variance.
- Fingerprints use only normalized repository-relative path, stable category/rule identifier, and normalized evidence anchor or line-range fallback. Severity, title, explanation prose, confidence, source, and provider finding ID are excluded.
- A raw current `ReviewReport` stays complete. Incremental state is an additional comparison envelope, not a destructive filter.
- Baseline storage orchestration remains outside the core comparison engine.

---

### Task 1: Scaffold the isolated comparison package and fingerprint contract

**Files:**
- Create: `packages/comparison/package.json`
- Create: `packages/comparison/tsconfig.json`
- Create: `packages/comparison/src/fingerprint.ts`
- Create: `packages/comparison/src/index.ts`
- Create: `packages/comparison/test/fingerprint.test.mjs`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `Finding` from `@aunoforge/core`.
- Produces: `normalizeFindingPath(path: string): string`, `normalizeEvidenceAnchor(finding: Finding): string`, `fingerprintFinding(finding: Finding): string`.

- [ ] **Step 1: Write the failing fingerprint tests**

Create `packages/comparison/test/fingerprint.test.mjs` with cases proving:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintFinding, normalizeEvidenceAnchor, normalizeFindingPath } from '../dist/index.js';

const base = {
  id: 'provider-id-1',
  severity: 'medium',
  category: 'javascript-eval',
  title: 'Avoid eval',
  evidence: ['  eval( userInput )\r\n'],
  location: { file: '.\\src\\app.js', startLine: 12, endLine: 12, verified: true },
  explanation: 'Original prose',
  confidence: 0.9,
  source: 'deterministic',
};

test('fingerprint normalizes path and evidence while ignoring prose severity and provider id', () => {
  assert.equal(normalizeFindingPath('.\\src\\app.js'), 'src/app.js');
  assert.equal(normalizeEvidenceAnchor(base), 'evidence:eval( userInput )');
  const original = fingerprintFinding(base);
  const rephrased = fingerprintFinding({ ...base, id: 'another-id', severity: 'high', title: 'Different title', explanation: 'Different prose' });
  assert.equal(original, rephrased);
  assert.match(original, /^af1:[a-f0-9]{64}$/);
});

test('fingerprint is stable when evidence order or whitespace changes', () => {
  const a = fingerprintFinding({ ...base, evidence: ['foo  bar', ' baz '] });
  const b = fingerprintFinding({ ...base, evidence: ['baz', 'foo bar'] });
  assert.equal(a, b);
});

test('fingerprint falls back to a verified line anchor when evidence is empty', () => {
  assert.equal(normalizeEvidenceAnchor({ ...base, evidence: [] }), 'line:12-12');
});

test('unlocated evidence-free findings use a deterministic repository anchor', () => {
  const fingerprint = fingerprintFinding({ ...base, evidence: [], location: undefined });
  assert.match(fingerprint, /^af1:[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Run the focused test and prove RED**

Run:

```bash
pnpm build && node --test packages/comparison/test/fingerprint.test.mjs
```

Expected: build/test failure because `packages/comparison` and the fingerprint exports do not exist.

- [ ] **Step 3: Add package metadata and TypeScript project reference**

Create `packages/comparison/package.json`:

```json
{
  "name": "@aunoforge/comparison",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": "./dist/index.js",
  "dependencies": {
    "@aunoforge/core": "workspace:*"
  }
}
```

Create `packages/comparison/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "composite": true },
  "references": [{ "path": "../core" }],
  "include": ["src/**/*.ts"]
}
```

Add `{ "path": "./packages/comparison" }` to root `tsconfig.json` before packages that consume it.

- [ ] **Step 4: Implement the minimal deterministic fingerprint**

Create `packages/comparison/src/fingerprint.ts`:

```ts
import { createHash } from "node:crypto";
import type { Finding } from "@aunoforge/core";

export function normalizeFindingPath(value: string | undefined): string {
  if (!value) return "<repository>";
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").trim();
  return normalized || "<repository>";
}

function normalizeEvidenceValue(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[\t ]+/g, " "))
    .filter(Boolean)
    .join("\n");
}

export function normalizeEvidenceAnchor(finding: Finding): string {
  const evidence = [...new Set(finding.evidence.map(normalizeEvidenceValue).filter(Boolean))].sort();
  if (evidence.length > 0) return `evidence:${evidence.join("\n")}`;
  const start = finding.location?.startLine;
  if (Number.isInteger(start) && (start ?? 0) > 0) {
    const end = Math.max(start as number, finding.location?.endLine ?? (start as number));
    return `line:${start}-${end}`;
  }
  return "global";
}

export function fingerprintFinding(finding: Finding): string {
  const semantic = [
    normalizeFindingPath(finding.location?.file),
    finding.category.trim().toLowerCase(),
    normalizeEvidenceAnchor(finding),
  ].join("\0");
  return `af1:${createHash("sha256").update(semantic, "utf8").digest("hex")}`;
}
```

Create `packages/comparison/src/index.ts`:

```ts
export * from "./fingerprint.js";
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm build && node --test packages/comparison/test/fingerprint.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the fingerprint contract**

```bash
git add packages/comparison tsconfig.json
git commit -m "feat: add stable finding fingerprints"
```

---

### Task 2: Implement baseline parsing and the four-state comparison engine

**Files:**
- Create: `packages/comparison/src/contracts.ts`
- Create: `packages/comparison/src/compare.ts`
- Create: `packages/comparison/test/compare.test.mjs`
- Modify: `packages/comparison/src/index.ts`

**Interfaces:**
- Consumes: `ReviewReport`, `Finding`, `Severity` from `@aunoforge/core`; `fingerprintFinding()` from Task 1.
- Produces: `IncrementalReviewReport`, `validateBaselineReport(input: unknown)`, `compareReviewReports(baseline: BaselineReport, current: ReviewReport): IncrementalReviewReport`.

- [ ] **Step 1: Write fixtures that prove all four states and history semantics**

Create tests that construct a baseline with fingerprints A/B/C and a current report where:

- A remains at the same severity -> `persistent`;
- B increases from `medium` to `high` -> `regressed` with reason `severity-increase`;
- C disappears -> `resolved`;
- D appears -> `new`.

Add a second test where a prior `IncrementalReviewReport.resolvedFingerprints` contains E, current E returns, and E becomes `regressed` with reason `returned`.

Add a third test proving the next `resolvedFingerprints` set is:

```text
(previous unresolved tombstones ∪ newly resolved fingerprints) - current fingerprints
```

Add a fourth test proving duplicate current findings with the same fingerprint collapse to one comparison representative chosen by highest severity, then lexicographically by finding ID, while `current.findings` remains complete.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm build && node --test packages/comparison/test/compare.test.mjs
```

Expected: FAIL because comparison contracts and engine do not exist.

- [ ] **Step 3: Define the comparison envelope**

Create `packages/comparison/src/contracts.ts` with these exported contracts:

```ts
import type { Finding, ReviewReport, Severity } from "@aunoforge/core";

export type IncrementalState = "new" | "persistent" | "regressed";
export type RegressionReason = "severity-increase" | "returned";

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
```

- [ ] **Step 4: Implement baseline validation without weakening core validation**

`validateBaselineReport(input)` must first recognize `kind === "incremental-review"`; validate `current` through `validateReviewReport`, validate state strings/counts/fingerprint prefixes/resolved entries, and otherwise fall back to `validateReviewReport(input)`.

Do not accept unknown incremental states or malformed fingerprints. Do not silently coerce invalid data.

- [ ] **Step 5: Implement deterministic comparison**

Use severity order:

```ts
const severityRank: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
```

Canonicalize each report into one representative per fingerprint. For collisions choose the highest severity; if severity ties, choose the lexicographically smaller `finding.id`. Sort comparison output by state priority `regressed`, `new`, `persistent`, then severity descending, path, line, fingerprint.

State rules:

```text
current fp in baseline current:
  current severity > baseline severity -> regressed(severity-increase)
  otherwise -> persistent
current fp absent from baseline current but in baseline resolvedFingerprints:
  -> regressed(returned)
current fp absent from both:
  -> new
baseline current fp absent from current:
  -> resolved
```

- [ ] **Step 6: Verify focused GREEN and offline determinism**

Run:

```bash
pnpm build && node --test packages/comparison/test/fingerprint.test.mjs packages/comparison/test/compare.test.mjs
```

Expected: PASS with no network access.

- [ ] **Step 7: Commit the comparison engine**

```bash
git add packages/comparison
git commit -m "feat: compare review baselines incrementally"
```

---

### Task 3: Add incremental presentation without changing no-baseline reporter output

**Files:**
- Create: `packages/reporters/src/incremental.ts`
- Create: `packages/reporters/test/incremental.test.mjs`
- Modify: `packages/reporters/src/reporter.ts`
- Modify: `packages/reporters/src/sarif.ts`
- Modify: `packages/reporters/src/index.ts`
- Modify: `packages/reporters/package.json`
- Modify: `packages/reporters/tsconfig.json`

**Interfaces:**
- Consumes: `IncrementalReviewReport` from `@aunoforge/comparison`.
- Produces: `renderIncrementalJson()`, `renderIncrementalMarkdown()`, `renderIncrementalTerminal()`, and optional comparison-aware `renderReport(report, format, incremental?)`.

- [ ] **Step 1: Write reporter RED tests**

Tests must prove:

1. `renderReport(report, format)` with no comparison is exactly unchanged for JSON/Markdown/Terminal/SARIF.
2. Incremental Markdown and Terminal lead with `regressed` and `new`, then show persistent findings secondarily and a resolved summary.
3. Incremental JSON serializes the `IncrementalReviewReport` envelope exactly and remains valid JSON.
4. Incremental SARIF keeps the full current verified result set, adds `aunoforgeFingerprint` and `aunoforgeState` properties to current results, and adds comparison counts to run properties; resolved findings do not become fake SARIF locations.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm build && node --test packages/reporters/test/incremental.test.mjs
```

Expected: FAIL because incremental rendering is absent.

- [ ] **Step 3: Wire the package dependency**

Add `"@aunoforge/comparison":"workspace:*"` to `packages/reporters/package.json` and add a TypeScript project reference to `../comparison`.

- [ ] **Step 4: Implement additive incremental rendering**

Keep `renderReport(report, format)` behavior unchanged when the third argument is absent. When `incremental` is present:

```ts
export function renderReport(
  report: ReviewReport,
  format: ReportFormat,
  incremental?: IncrementalReviewReport,
): string {
  if (!incremental) return renderCurrentReport(report, format);
  if (format === "json") return renderIncrementalJson(incremental);
  if (format === "markdown") return renderIncrementalMarkdown(incremental);
  if (format === "terminal") return renderIncrementalTerminal(incremental);
  return renderSarif(report, incremental);
}
```

Do not remove persistent findings from the raw current report.

- [ ] **Step 5: Verify reporter GREEN**

Run:

```bash
pnpm build && node --test packages/reporters/test/*.test.mjs
```

Expected: all reporter tests PASS.

- [ ] **Step 6: Commit presentation support**

```bash
git add packages/reporters
git commit -m "feat: render incremental review states"
```

---

### Task 4: Add explicit CLI baseline input and reusable JSON snapshots

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/tsconfig.json`
- Modify: `packages/cli/src/app.ts`
- Modify: `packages/cli/test/cli.test.mjs`
- Add fixtures under: `packages/cli/test/fixtures/incremental/`

**Interfaces:**
- Consumes: `validateBaselineReport()`, `compareReviewReports()`, comparison-aware `renderReport()`.
- Produces: `aunoforge review --baseline <path>`.

- [ ] **Step 1: Write CLI RED tests**

Use deterministic local diff fixtures. Prove:

```text
review --baseline baseline.json --format json
```

returns `kind: "incremental-review"` with expected state counts and no network calls.

Also prove:

- a malformed baseline exits non-zero with a clear validation error;
- `--baseline` is review-only and does not alter triage/reproduce format parsing;
- a prior incremental JSON output can be supplied as the next baseline and a returned resolved fingerprint becomes `regressed`;
- without `--baseline`, existing JSON output remains a plain `ReviewReport`.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm build && node --test packages/cli/test/*.test.mjs
```

Expected: only the new baseline tests fail for missing baseline behavior.

- [ ] **Step 3: Add comparison dependency/project reference**

Add `@aunoforge/comparison` to CLI dependencies and TypeScript references.

- [ ] **Step 4: Implement baseline loading in `review` only**

Inside the review branch:

```ts
const baselinePath = argValue(args, "--baseline");
const baseline = baselinePath
  ? validateBaselineReport(JSON.parse(await readFile(resolve(baselinePath), "utf8")))
  : undefined;

const report = /* existing review pipeline */;
const incremental = baseline ? compareReviewReports(baseline, report) : undefined;
console.log(renderReport(report, format, incremental).trimEnd());
```

Do not add implicit artifact lookup, GitHub API lookup, or remote state storage.

- [ ] **Step 5: Verify CLI GREEN**

Run:

```bash
pnpm build && node --test packages/cli/test/*.test.mjs packages/comparison/test/*.test.mjs packages/reporters/test/*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit CLI baseline support**

```bash
git add packages/cli
git commit -m "feat: compare review against explicit baseline"
```

---

### Task 5: Integrate optional Action baseline and lead Step Summary with new/regressed evidence

**Files:**
- Modify: `action.yml`
- Modify: `scripts/action.mjs`
- Modify: `scripts/action-summary.mjs`
- Modify: `test/action-manifest.test.mjs`
- Modify: `test/action-runtime.test.mjs`
- Modify: `test/action-summary.test.mjs`

**Interfaces:**
- Consumes: optional `INPUT_BASELINE`, `validateBaselineReport()`, `compareReviewReports()`.
- Produces: optional Action input `baseline`; comparison-aware report output and Step Summary; no new GitHub permission.

- [ ] **Step 1: Write Action manifest/summary/runtime RED tests**

Manifest test must require:

```yaml
baseline:
  description: Optional path to a prior AunoForge JSON report for incremental comparison.
  required: false
  default: ''
```

and explicitly assert there is still no token input and no write-capable permission declaration.

Summary tests must require an incremental row before raw severity detail:

```text
| Incremental | New 2 · Regressed 1 · Persistent 3 · Resolved 1 |
```

Runtime integration must execute the packaged Action with a local baseline fixture and prove the generated JSON report is an incremental envelope.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm build && node --test test/action-manifest.test.mjs test/action-summary.test.mjs test/action-runtime.test.mjs
```

Expected: new baseline assertions fail while existing Action tests remain green.

- [ ] **Step 3: Implement maintained Action integration**

In `scripts/action.mjs`:

```js
const baselinePathInput = process.env.INPUT_BASELINE || '';
const baseline = baselinePathInput
  ? validateBaselineReport(JSON.parse(await readFile(resolve(workspace, baselinePathInput), 'utf8')))
  : undefined;

const structuredReport = validateReviewReport(JSON.parse(rawReport));
const incremental = baseline ? compareReviewReports(baseline, structuredReport) : undefined;
const report = renderReport(structuredReport, format, incremental);
```

Pass `incremental?.summary` to Step Summary.

When an incremental comparison exists, limit workflow annotations to current findings whose comparison state is `new` or `regressed`; without a baseline, preserve Phase 2 annotation behavior exactly.

Do not add a GitHub API call to find/download a baseline.

- [ ] **Step 4: Verify maintained-source GREEN**

Run:

```bash
pnpm build && node --test test/action-manifest.test.mjs test/action-summary.test.mjs test/action-runtime.test.mjs packages/comparison/test/*.test.mjs packages/reporters/test/*.test.mjs packages/cli/test/*.test.mjs
```

Expected: source-level behavior passes except generated-runtime drift if `dist/action/*` is stale.

- [ ] **Step 5: Commit maintained Action source**

```bash
git add action.yml scripts test
git commit -m "feat: add incremental Action baseline"
```

---

### Task 6: Document the baseline boundary and example workflow usage

**Files:**
- Modify: `docs/getting-started.md`
- Modify: `docs/commands/review.md`
- Modify: `docs/examples/aunoforge-review.yml`
- Modify: `test/action-artifact-example.test.mjs`

**Interfaces:**
- Documents the public `--baseline` / Action `baseline` path without adding artifact-download orchestration to AunoForge core.

- [ ] **Step 1: Write documentation contract tests first**

Require the docs to state all of the following literally or semantically:

- baseline input is an explicit local path to a prior AunoForge JSON report;
- comparison works offline;
- AunoForge does not remotely store or auto-discover baselines;
- `new`, `persistent`, `resolved`, and `regressed` definitions;
- severity increase and returned-resolved fingerprint both count as `regressed`;
- users may orchestrate prior artifact download in their workflow, but that orchestration is outside AunoForge core.

The example may show a commented/optional baseline line, but it must not introduce a write permission.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm build && node --test test/action-artifact-example.test.mjs
```

Expected: new Phase 3 documentation assertions fail.

- [ ] **Step 3: Update docs and example**

Document CLI example:

```bash
node packages/cli/dist/bin.js review \
  --root /path/to/repo \
  --provider mock \
  --diff ./change.diff \
  --baseline ./previous-aunoforge-review.json \
  --format json
```

Document Action input example:

```yaml
with:
  command: review
  provider: mock
  format: json
  baseline: .aunoforge/baseline.json
  comment: 'false'
```

Keep workflow permissions read-only.

- [ ] **Step 4: Verify docs GREEN**

Run:

```bash
pnpm build && node --test test/action-artifact-example.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit documentation**

```bash
git add docs test/action-artifact-example.test.mjs
git commit -m "docs: explain incremental evidence baselines"
```

---

### Task 7: Regenerate the checked-in Node 24 Action runtime reproducibly

**Files:**
- Modify generated: `dist/action/index.mjs`
- Modify generated: `dist/action/cli.mjs`

**Interfaces:**
- Generated from maintained TypeScript/Action source only via `pnpm build:action`.

- [ ] **Step 1: Run the exact locked packaging sequence**

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm build:action
```

- [ ] **Step 2: Run focused packaged-runtime tests**

```bash
node --test test/action-manifest.test.mjs test/action-summary.test.mjs test/action-runtime.test.mjs packages/comparison/test/*.test.mjs packages/reporters/test/*.test.mjs packages/cli/test/*.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Verify generated runtime is reproducible**

Run `pnpm build:action` a second time, then:

```bash
git diff --exit-code -- dist/action/index.mjs dist/action/cli.mjs
```

Expected: exit 0 after the first generated bytes have been staged/committed for comparison, proving the second generation creates no drift.

- [ ] **Step 4: Commit only generated runtime bytes**

```bash
git add dist/action/index.mjs dist/action/cli.mjs
git commit -m "build: regenerate Action runtime for incremental review"
```

Do not hand-edit generated runtime files.

---

### Task 8: Full verification, review gate, and one controlled PR

**Files:**
- No new production scope.
- Review all Phase 3 changed files.

**Interfaces:**
- Produces one human-merge-gated PR from `feat/v0.2-incremental-evidence` to `main`.

- [ ] **Step 1: Run full local/CI-equivalent verification**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:action
git diff --exit-code -- dist/action/index.mjs dist/action/cli.mjs
```

Then validate all builtin recipes using the repository's maintained CI command.

Expected: all commands PASS, zero generated-runtime drift.

- [ ] **Step 2: Verify Phase 3 requirements line by line**

Confirm:

```text
fingerprint stable across equivalent runs
explanation/title/provider id/severity do not alter primary fingerprint
severity increase => regressed without fingerprint change
resolved fingerprint return => regressed
new/persistent/resolved/regressed deterministic fixtures pass
two JSON reports compare fully offline
raw current report remains complete inside incremental envelope
no remote baseline storage or auto-discovery
no new GitHub write permission
no-baseline CLI and Action behavior remains compatible
```

- [ ] **Step 3: Open exactly one Draft PR**

Title:

```text
feat: add incremental evidence review baselines
```

Body must summarize architecture, fingerprint inputs, state machine, baseline boundary, TDD RED/GREEN evidence, generated runtime provenance, and explicitly state `No auto-merge`.

- [ ] **Step 4: Require PR-triggered gates on the exact head**

Require:

- AunoForge Review SUCCESS;
- CI SUCCESS on Node 20/22/24;
- generated-runtime drift PASS;
- macOS smoke PASS;
- Windows smoke PASS;
- report artifact inspection shows no HIGH/CRITICAL finding requiring action;
- no unresolved review threads.

- [ ] **Step 5: Mark Ready for review only after all exact-head gates pass**

Do not merge. Human merge remains mandatory before Phase 4 begins.

## Plan self-review

- Spec coverage: fingerprint inputs, all four states, severity regression, returned resolved fingerprints, explicit JSON baseline, offline operation, no remote store, noise controls, Step Summary, and raw-report preservation all map to explicit tasks.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
- Type consistency: `IncrementalReviewReport`, `ComparedFinding`, `ResolvedFinding`, `IncrementalSummary`, `validateBaselineReport`, `compareReviewReports`, and `fingerprintFinding` have one canonical spelling across tasks.
- Scope check: Phase 3 is one coherent subsystem; remote artifact discovery, sticky comments, security intelligence, and Phase 4+ are excluded.
