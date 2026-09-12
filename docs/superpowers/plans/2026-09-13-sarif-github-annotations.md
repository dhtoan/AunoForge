# SARIF and GitHub Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured reporter contract, SARIF 2.1.0 output, and least-privilege diff-scoped GitHub workflow annotations without changing AunoForge review semantics or enabling repository writes.

**Architecture:** Keep `ReviewReport` as the canonical review result. `@aunoforge/reporters` becomes the presentation boundary: Markdown, JSON, terminal, SARIF, and pure GitHub annotation selection all derive from the same normalized report. The Action continues to execute the provider/review pipeline once in JSON mode, renders the requested report from that object, fetches the PR diff read-only only for annotation scoping, emits GitHub workflow-command annotations to stdout, and extends Step Summary with emitted/overflow counts. Checks API integration remains out of scope.

**Tech Stack:** TypeScript 5.8, Node.js 20+ CLI, Node 24 GitHub Action host, pnpm 10.15.1, Node built-in test runner, esbuild 0.28.2, GitHub Actions workflow commands, SARIF 2.1.0.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md` — Phase 2: Structured reporter architecture.

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge.
- Read-only behavior remains the default.
- Any GitHub write requires explicit configuration and the minimum required permission.
- Fork-originated pull requests must never gain an implicit write path.
- Provider credentials are optional unless the user explicitly selects a network provider.
- Deterministic/mock mode remains a first-class zero-key path.
- Reporter code must never create or reinterpret findings; it only presents one validated `ReviewReport`.
- SARIF version is exactly `2.1.0`.
- Only evidence-verified file/line findings are eligible for location-based SARIF results and GitHub annotations.
- GitHub annotations must intersect changed PR lines.
- Default annotation threshold is `medium`.
- Default annotation cap is `25` per Action run.
- Eligible findings above the cap remain in the full report and are counted as overflow in Step Summary.
- GitHub workflow annotations are preferred; Checks API writes are deferred.
- Reporter selection alone must never create a PR comment.
- Generated runtime must stay reproducible and pass drift checks.

## File Structure

- Create `packages/reporters/src/reporter.ts` — central `ReportFormat` type and `renderReport()` dispatcher.
- Create `packages/reporters/src/sarif.ts` — deterministic SARIF 2.1.0 projection from verified findings.
- Create `packages/reporters/src/github.ts` — pure unified-diff changed-line parsing and annotation selection.
- Modify `packages/reporters/src/index.ts` — export the new reporter APIs.
- Modify `packages/reporters/test/reporters.test.mjs` — preserve existing Markdown/JSON/terminal contracts and add dispatcher coverage.
- Create `packages/reporters/test/sarif.test.mjs` — SARIF structure, stable rule ids, severity/location filtering.
- Create `packages/reporters/test/github-annotations.test.mjs` — diff scope, threshold, ordering, cap, overflow.
- Create `scripts/action-annotations.mjs` — escape and emit selected annotations as GitHub workflow commands.
- Modify `scripts/action-summary.mjs` — add annotation emitted/overflow metadata without changing existing summary fields.
- Modify `scripts/action.mjs` — render via reporter contract, support SARIF, fetch PR diff read-only for annotation scoping, emit annotations, pass annotation counts to Step Summary.
- Modify `action.yml` — document `sarif` as a report format. No new write-capable input.
- Modify `packages/cli/src/app.ts` — accept `--format sarif`.
- Modify `packages/cli/src/review.ts` — delegate rendering to `renderReport()` and include `sarif` in the format type.
- Modify `test/action-manifest.test.mjs` — assert the public format contract includes SARIF while write boundaries stay unchanged.
- Modify `test/action-runtime.test.mjs` — packaged Action SARIF output and annotation integration coverage.
- Modify `test/action-summary.test.mjs` — annotation count/overflow summary coverage.
- Modify `docs/getting-started.md` and `docs/examples/aunoforge-review.yml` — document SARIF and least-privilege annotations.
- Regenerate `dist/action/index.mjs` from maintained source; `dist/action/cli.mjs` changes only if the CLI bundle actually changes.

---

### Task 1: Central Reporter Contract

**Files:**
- Create: `packages/reporters/src/reporter.ts`
- Modify: `packages/reporters/src/index.ts`
- Modify: `packages/reporters/test/reporters.test.mjs`

**Interfaces:**
- Produces: `export type ReportFormat = "terminal" | "markdown" | "json" | "sarif"`.
- Produces: `export function renderReport(report: ReviewReport, format: ReportFormat): string`.
- Consumes later: CLI and Action use this dispatcher so review semantics run once and presentation fans out afterward.

- [ ] **Step 1: Write the failing dispatcher test**

Add to `packages/reporters/test/reporters.test.mjs`:

```js
import { renderReport } from '../dist/index.js';

test('report dispatcher preserves existing formats', () => {
  assert.equal(renderReport(sample, 'json'), renderJson(sample));
  assert.equal(renderReport(sample, 'markdown'), renderMarkdown(sample));
  assert.equal(renderReport(sample, 'terminal'), renderTerminal(sample));
});
```

- [ ] **Step 2: Run the focused reporter test and prove RED**

Run:

```bash
pnpm build && node --test packages/reporters/test/reporters.test.mjs
```

Expected: FAIL because `renderReport` is not exported.

- [ ] **Step 3: Implement the dispatcher without changing existing renderers**

Create `packages/reporters/src/reporter.ts`:

```ts
import type { ReviewReport } from "@aunoforge/core";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderTerminal } from "./terminal.js";
import { renderSarif } from "./sarif.js";

export type ReportFormat = "terminal" | "markdown" | "json" | "sarif";

export function renderReport(report: ReviewReport, format: ReportFormat): string {
  if (format === "json") return renderJson(report);
  if (format === "markdown") return renderMarkdown(report);
  if (format === "sarif") return renderSarif(report);
  return renderTerminal(report);
}
```

Export `reporter.ts` from `packages/reporters/src/index.ts`. `sarif.ts` is introduced in Task 2; until that task lands, keep this task's branch RED only long enough to establish the contract, then complete Task 2 before claiming a green package build.

- [ ] **Step 4: Commit the contract test and dispatcher skeleton as one TDD checkpoint**

```bash
git add packages/reporters/src/reporter.ts packages/reporters/src/index.ts packages/reporters/test/reporters.test.mjs
git commit -m "test: define structured reporter contract"
```

### Task 2: SARIF 2.1.0 Reporter

**Files:**
- Create: `packages/reporters/src/sarif.ts`
- Create: `packages/reporters/test/sarif.test.mjs`
- Modify: `packages/reporters/src/index.ts`

**Interfaces:**
- Produces: `renderSarif(report: ReviewReport): string`.
- Rule id: exactly `finding.category`.
- Result eligibility: `finding.location?.verified === true` and positive `startLine`.
- Severity mapping: `critical|high -> error`, `medium -> warning`, `low|info -> note`.
- Determinism: unique rules sorted by category; results sorted by severity rank descending, then file, line, category, id.

- [ ] **Step 1: Write failing SARIF tests**

Create a fixture with one verified high finding, one verified medium finding, and one unverified model finding. Assert:

```js
const sarif = JSON.parse(renderSarif(report));
assert.equal(sarif.version, '2.1.0');
assert.equal(sarif.runs[0].tool.driver.name, 'AunoForge');
assert.deepEqual(sarif.runs[0].tool.driver.rules.map(rule => rule.id), ['javascript-eval', 'regression']);
assert.equal(sarif.runs[0].results.length, 2);
assert.equal(sarif.runs[0].results[0].level, 'error');
assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'src/a.js');
assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 4);
assert.ok(!JSON.stringify(sarif).includes('unverified-claim'));
```

Also assert the serialized output ends with `\n` and repeated calls are byte-identical.

- [ ] **Step 2: Run the focused test and prove RED**

```bash
pnpm build && node --test packages/reporters/test/sarif.test.mjs
```

Expected: FAIL because `renderSarif` does not exist.

- [ ] **Step 3: Implement minimal SARIF projection**

Use this shape in `packages/reporters/src/sarif.ts`:

```ts
{
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "AunoForge", rules } },
    results
  }]
}
```

Each result contains:

```ts
{
  ruleId: finding.category,
  level,
  message: { text: finding.title },
  locations: [{
    physicalLocation: {
      artifactLocation: { uri: finding.location.file },
      region: {
        startLine: finding.location.startLine,
        ...(finding.location.endLine ? { endLine: finding.location.endLine } : {})
      }
    }
  }],
  properties: {
    aunoforgeFindingId: finding.id,
    aunoforgeSource: finding.source,
    confidence: finding.confidence,
    evidence: finding.evidence
  }
}
```

Rule descriptors contain stable `id`, `name` equal to category, and `shortDescription.text` from the first deterministic title for that category after deterministic sort.

- [ ] **Step 4: Run focused SARIF + existing reporter tests GREEN**

```bash
pnpm build && node --test packages/reporters/test/reporters.test.mjs packages/reporters/test/sarif.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit SARIF reporter**

```bash
git add packages/reporters/src packages/reporters/test
git commit -m "feat: add deterministic SARIF reporter"
```

### Task 3: Diff-Scoped GitHub Annotation Selection

**Files:**
- Create: `packages/reporters/src/github.ts`
- Create: `packages/reporters/test/github-annotations.test.mjs`
- Modify: `packages/reporters/src/index.ts`

**Interfaces:**
- Produces: `parseChangedLineScope(diff: string): Map<string, Set<number>>`.
- Produces: `selectGitHubAnnotations(report, diff, options?)` returning `{ annotations, eligible, overflow }`.
- Annotation type fields: `level`, `file`, `line`, `endLine`, `title`, `message`, `findingId`.
- Defaults: `minimumSeverity="medium"`, `limit=25`.
- Eligibility: verified location, positive line, severity at/above threshold, at least one line in verified range intersects a changed line.

- [ ] **Step 1: Write failing diff-scope tests**

Cover this unified diff:

```diff
diff --git a/src/a.js b/src/a.js
--- a/src/a.js
+++ b/src/a.js
@@ -2,2 +2,3 @@
 keep
+changed
 keep
+changed-again
```

Assert changed lines are `src/a.js:3` and `src/a.js:5`.

- [ ] **Step 2: Write failing annotation policy tests**

Build findings that prove:

```js
assert.equal(result.annotations.length, 3); // critical/high/medium on changed verified lines
assert.equal(result.annotations[0].level, 'error');
assert.equal(result.annotations[2].level, 'warning');
assert.equal(result.eligible, 3);
assert.equal(result.overflow, 0);
```

Also prove these are excluded by default:

- verified high finding outside changed lines;
- unverified high model finding on a changed line;
- verified low finding on a changed line.

Add a cap fixture with 30 eligible findings and assert `annotations.length === 25`, `eligible === 30`, `overflow === 5`.

- [ ] **Step 3: Run the focused test and prove RED**

```bash
pnpm build && node --test packages/reporters/test/github-annotations.test.mjs
```

Expected: FAIL because the GitHub reporter API does not exist.

- [ ] **Step 4: Implement the pure selector**

Use severity ranks:

```ts
const severityRank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
```

For an eligible range, choose the first changed line inside `[startLine, endLine ?? startLine]` as `line`. Set `endLine` equal to that selected changed line so the annotation is guaranteed to target changed code.

Sort eligible findings by severity descending, then file ascending, selected line ascending, category ascending, id ascending before applying the cap.

Map annotation level:

```ts
critical/high -> error
medium -> warning
low/info -> notice
```

- [ ] **Step 5: Run focused annotation tests GREEN**

```bash
pnpm build && node --test packages/reporters/test/github-annotations.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit annotation selector**

```bash
git add packages/reporters/src/github.ts packages/reporters/src/index.ts packages/reporters/test/github-annotations.test.mjs
git commit -m "feat: add diff-scoped GitHub annotations"
```

### Task 4: GitHub Workflow Command Encoder

**Files:**
- Create: `scripts/action-annotations.mjs`
- Create: `test/action-annotations.test.mjs`

**Interfaces:**
- Produces: `formatGitHubAnnotation(annotation): string`.
- Produces: `emitGitHubAnnotations(annotations, write = chunk => process.stdout.write(chunk)): void`.
- This module does not call GitHub REST APIs and cannot mutate repository state.

- [ ] **Step 1: Write failing workflow-command tests**

Assert exact formatting:

```js
assert.equal(
  formatGitHubAnnotation({
    level: 'warning', file: 'src/a.js', line: 3, endLine: 3,
    title: 'Regression, risk', message: 'Line 1\nLine 2', findingId: 'f-1'
  }),
  '::warning file=src/a.js,line=3,endLine=3,title=Regression%2C risk::Line 1%0ALine 2\n'
);
```

Add escaping coverage for `%`, carriage return, line feed, `:`, and `,` in property values; message escaping must cover `%`, CR, and LF.

- [ ] **Step 2: Run the focused test and prove RED**

```bash
node --test test/action-annotations.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the encoder**

Property escaping order:

```text
% -> %25
\r -> %0D
\n -> %0A
: -> %3A
, -> %2C
```

Message escaping order:

```text
% -> %25
\r -> %0D
\n -> %0A
```

Do not escape or rewrite the repository path beyond workflow-command escaping; path normalization belongs to the verified finding contract.

- [ ] **Step 4: Run focused tests GREEN and commit**

```bash
node --test test/action-annotations.test.mjs
git add scripts/action-annotations.mjs test/action-annotations.test.mjs
git commit -m "feat: encode GitHub workflow annotations"
```

### Task 5: CLI SARIF Surface

**Files:**
- Modify: `packages/cli/src/app.ts`
- Modify: `packages/cli/src/review.ts`
- Modify: relevant CLI tests under `packages/cli/test/`

**Interfaces:**
- CLI accepts `--format sarif` only for commands that use the shared review format path.
- `renderReview(report, format)` delegates to `renderReport(report, format)`.
- Existing `terminal`, `markdown`, and `json` behavior remains byte-compatible unless existing tests intentionally allow whitespace differences.

- [ ] **Step 1: Add a failing CLI SARIF test**

Run the mock review against a deterministic diff and assert:

```js
const parsed = JSON.parse(stdout);
assert.equal(parsed.version, '2.1.0');
assert.equal(parsed.runs[0].tool.driver.name, 'AunoForge');
```

- [ ] **Step 2: Prove RED**

```bash
pnpm build && node --test packages/cli/test/*.test.mjs
```

Expected: the new test fails with `--format must be terminal, markdown, or json`.

- [ ] **Step 3: Extend format validation and rendering**

Change the shared format union to include `sarif` and make `renderReview()` call `renderReport()`.

Do not add `github` as a CLI string format; GitHub annotations are a GitHub Action side channel, not a portable document format.

- [ ] **Step 4: Run CLI + reporter tests GREEN and commit**

```bash
pnpm build && node --test packages/cli/test/*.test.mjs packages/reporters/test/*.test.mjs
git add packages/cli/src packages/cli/test
git commit -m "feat: expose SARIF review output in CLI"
```

### Task 6: Action SARIF + Least-Privilege Annotation Integration

**Files:**
- Modify: `action.yml`
- Modify: `scripts/action.mjs`
- Modify: `scripts/action-summary.mjs`
- Modify: `test/action-manifest.test.mjs`
- Modify: `test/action-runtime.test.mjs`
- Modify: `test/action-summary.test.mjs`

**Interfaces:**
- Public `format` input accepts `markdown`, `json`, `terminal`, `sarif`.
- Action still invokes the CLI provider/review pipeline exactly once in canonical JSON mode.
- Action renders the requested full report with `renderReport()`.
- SARIF file name is `aunoforge-review.sarif`.
- On a valid `pull_request` event, Action obtains the PR diff with read-only `GET /repos/{owner}/{repo}/pulls/{number}` and `Accept: application/vnd.github.v3.diff` using `GITHUB_API_URL || https://api.github.com` and optional `GITHUB_TOKEN`.
- Diff-fetch failure does not fabricate scope and does not emit annotations; report generation still succeeds and Step Summary records zero emitted annotations with no overflow.
- No Checks API call, issue comment, or repository write is added.

- [ ] **Step 1: Write failing Action manifest/SARIF tests**

Assert `action.yml` documents SARIF but does not add `checks: write`, a token input, or a new write switch.

Add a packaged Action test with `INPUT_FORMAT=sarif` and no PR event, asserting `aunoforge-review.sarif` parses and `report-path` points to that file.

- [ ] **Step 2: Write failing Step Summary annotation-count test**

Extend `renderActionStepSummary()` input with:

```js
annotationSummary: { eligible: 30, emitted: 25, overflow: 5 }
```

Assert the summary contains:

```text
Annotations | 25 emitted · 5 overflow
```

and still contains the existing read-only/write-mode statement.

- [ ] **Step 3: Write failing packaged Action annotation integration test**

Use a temporary HTTP server in the test to serve a deterministic PR diff. Set:

```text
GITHUB_API_URL=http://127.0.0.1:<port>
GITHUB_EVENT_PATH=<fixture event JSON>
GITHUB_REPOSITORY=owner/repo
GITHUB_TOKEN=test-token
```

Create a repository fixture whose review yields one verified medium/high finding on a changed line. Capture stdout and assert it contains exactly one `::warning` or `::error` command for that changed location.

The fake server must assert the request method is `GET`, the path is `/repos/owner/repo/pulls/7`, and the Accept header requests GitHub diff media type. No POST/PATCH/PUT/DELETE request is accepted.

- [ ] **Step 4: Prove RED**

```bash
pnpm build && node --test test/action-manifest.test.mjs test/action-summary.test.mjs test/action-runtime.test.mjs
```

Expected: failures because SARIF is not a public format, annotation summary metadata is absent, and Action does not fetch/emit annotations.

- [ ] **Step 5: Implement minimal Action integration**

Reuse the validated `structuredReport`. For annotations:

1. only enter annotation flow when a valid PR number, owner, and repo are present;
2. fetch diff read-only;
3. call `selectGitHubAnnotations(structuredReport, diff)` with default policy;
4. call `emitGitHubAnnotations(result.annotations)`;
5. pass `{eligible, emitted: annotations.length, overflow}` into Step Summary.

If diff fetch fails, write a concise stderr diagnostic and use `{eligible:0, emitted:0, overflow:0}`; never fall back to unscoped annotations.

- [ ] **Step 6: Run focused Action tests GREEN**

```bash
pnpm build && node --test test/action-manifest.test.mjs test/action-annotations.test.mjs test/action-summary.test.mjs test/action-runtime.test.mjs packages/reporters/test/*.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit maintained source/tests before generated runtime**

```bash
git add action.yml scripts packages/cli/src packages/cli/test packages/reporters/src packages/reporters/test test
git commit -m "feat: integrate SARIF and GitHub annotations"
```

### Task 7: Reproducible Node 24 Runtime Generation

**Files:**
- Regenerate: `dist/action/index.mjs`
- Regenerate if changed: `dist/action/cli.mjs`

**Interfaces:**
- Generated bytes must come only from `pnpm build:action` with the locked pnpm/esbuild versions.
- Never hand-edit `dist/action/*`.

- [ ] **Step 1: Build generated runtime**

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm build:action
```

- [ ] **Step 2: Run packaged runtime tests**

```bash
node --test test/action-runtime.test.mjs test/action-manifest.test.mjs test/action-summary.test.mjs test/action-annotations.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Verify generated runtime drift is clean**

```bash
git diff --exit-code -- scripts/action.mjs scripts/action-summary.mjs scripts/action-annotations.mjs packages/core/dist packages/reporters/dist packages/cli/dist
pnpm build:action
git diff --exit-code -- dist/action packages/core/dist packages/reporters/dist packages/cli/dist
```

Expected: second build produces no additional diff.

- [ ] **Step 4: Commit generated bytes**

```bash
git add dist/action/index.mjs dist/action/cli.mjs
git commit -m "build: regenerate Action runtime for structured reporters"
```

If one generated file is byte-identical, do not include it in the commit.

### Task 8: Documentation and Maintained Workflow Proof

**Files:**
- Modify: `docs/getting-started.md`
- Modify: `docs/examples/aunoforge-review.yml`
- Modify: `.github/workflows/aunoforge-review.yml`
- Test: existing docs-link and Action workflow contract tests

**Interfaces:**
- Docs explain that annotations use workflow commands and require no `checks: write` permission.
- Docs explain that SARIF is a report format, not an automatic GitHub code-scanning upload.
- Maintained workflow exercises SARIF as a third Action invocation and includes its `report-path` in the existing `aunoforge-report` artifact.
- Maintained workflow keeps `contents: read`, `issues: read`, `pull-requests: read` only.

- [ ] **Step 1: Write/update workflow contract tests first**

Assert:

```text
format: sarif
name: aunoforge-report
```

and that workflow permissions do not contain `write`.

- [ ] **Step 2: Prove RED**

```bash
pnpm test
```

Expected: new workflow contract fails before the SARIF smoke invocation/docs are added.

- [ ] **Step 3: Update docs and workflow**

Add a concise SARIF example and annotation behavior notes. Do not document Checks API support or automatic code-scanning upload.

- [ ] **Step 4: Run full repository verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:action
git diff --exit-code -- dist/action packages/core/dist packages/reporters/dist packages/cli/dist
```

Expected: all commands exit 0 and generated-runtime drift is empty after the authoritative build.

- [ ] **Step 5: Commit docs/workflow proof**

```bash
git add docs .github/workflows/aunoforge-review.yml test
git commit -m "docs: prove SARIF and least-privilege annotations"
```

### Task 9: GitHub CI, Self-Review, and Single Primary PR

**Files:**
- No production files unless CI exposes a genuine defect.

**Interfaces:**
- Branch: `feat/v0.2-sarif-annotations`.
- PR title: `feat: add SARIF and diff-scoped GitHub annotations`.
- Human merge remains mandatory.

- [ ] **Step 1: Verify no other maintainer primary upgrade PR is open**

Use the GitHub PR listing before PR creation. If another primary PR exists, stop instead of opening an overlapping one.

- [ ] **Step 2: Review final diff against `main`**

The final diff should contain only reporter/SARIF/annotation implementation, tests, generated runtime, maintained workflow/docs, and this implementation plan. Remove any temporary packaging workflow, scratch note, placeholder file, or unrelated refactor.

- [ ] **Step 3: Open one draft PR**

Create the PR as draft so PR-triggered CI and AunoForge Review can inspect the exact head.

- [ ] **Step 4: Require PR-specific checks**

On the exact PR head require:

```text
AunoForge Review: success
CI Node 20: success
CI Node 22: success
CI Node 24: success
macOS smoke: success
Windows smoke: success
generated-runtime drift: success
```

Inspect the `aunoforge-report` artifact. Any HIGH/CRITICAL self-review finding must be investigated before Ready for review; do not suppress a real finding merely to obtain green status.

- [ ] **Step 5: Update PR body with exact current-head evidence**

Record TDD RED/GREEN evidence, SARIF contract, annotation least-privilege behavior, annotation cap/overflow behavior, generated-runtime provenance, and exact current head SHA.

- [ ] **Step 6: Mark Ready for review only after all gates pass**

Do not merge. Do not enable auto-merge. Stop at the human merge gate before Phase 3.

## Plan Self-Review

- Spec coverage: reporter contract, SARIF 2.1.0, stable category rule ids, verified locations, diff scoping, default `medium` threshold, 25 annotation cap, overflow summary, no implicit PR comment, and no Checks API writes are all mapped to explicit tasks.
- Placeholder scan: no TODO/TBD/"implement later" placeholders remain.
- Type consistency: `ReportFormat`, `renderReport`, `renderSarif`, `selectGitHubAnnotations`, `formatGitHubAnnotation`, and annotation summary names are consistent across tasks.
- Scope check: Phase 3 fingerprints/baselines, security intelligence, sticky comments, code-scanning upload, and Checks API integration are explicitly excluded.
