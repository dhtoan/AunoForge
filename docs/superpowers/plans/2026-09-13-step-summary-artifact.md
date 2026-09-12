# GitHub Step Summary and Optional Artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every AunoForge GitHub Action review produce a concise GitHub Step Summary by default, while keeping report artifact upload optional, workflow-owned, and independent of PR-comment write permissions.

**Architecture:** Keep the packaged Node 24 JavaScript Action as the integration boundary. The Action will execute the CLI once in canonical JSON mode, validate the structured report, render the user-requested Markdown/JSON/terminal report with the existing reporter package, write the existing `report-path` output, and append a concise summary to `GITHUB_STEP_SUMMARY` when GitHub provides that file. Artifact upload remains outside AunoForge core and is demonstrated as an optional `actions/upload-artifact@v4` workflow step using the existing `report-path` output.

**Tech Stack:** Node.js 24 GitHub JavaScript Action, Node.js built-in test runner, AunoForge core/reporters packages, esbuild 0.28.2, pnpm 10.15.1, GitHub Actions Step Summary, actions/upload-artifact@v4.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md`

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time; this plan uses branch `feat/v0.2-step-summary-artifact` after PR #10 merged.
- No auto-merge.
- Read-only behavior remains the default.
- PR comments remain disabled unless both `comment=true` and `allow-write=true` are explicitly selected.
- Step Summary generation must require no additional GitHub token permission.
- Artifact upload stays outside the AunoForge JavaScript Action runtime and must use `actions/upload-artifact@v4` at workflow level.
- Mock mode remains a zero-key, no-external-model-request path.
- The Action must invoke the review provider only once per Action run; Step Summary must not trigger a second provider review.
- Existing Action inputs and `report-path` output remain compatible.
- User-requested `markdown`, `json`, and `terminal` report formats retain their current meaning.
- The packaged Action remains `runs.using: node24`.
- Generated `dist/action/` files are rebuilt from source and never hand-edited.
- CI continues to test Node 20/22/24 for the CLI plus macOS/Windows platform smoke.
- Behavior-changing work follows RED -> GREEN verification.

---

## File Structure

- Create `scripts/action-summary.mjs`: pure Step Summary formatting and verified/unverified counting; no GitHub API calls or file I/O.
- Modify `scripts/action.mjs`: obtain one canonical JSON review, validate it, render the requested report format, write report/output/Step Summary, preserve optional PR comment behavior.
- Modify `test/action-runtime.test.mjs`: integration contract for Step Summary, requested report format, report-path behavior, and no implicit write requirement.
- Create `test/action-summary.test.mjs`: fast unit contract for summary formatting and verification counts.
- Regenerate `dist/action/index.mjs`: bundled Action entry containing the new summary/reporting logic.
- `dist/action/cli.mjs` may remain byte-identical unless the build proves otherwise; never edit it manually.
- Modify `.github/workflows/aunoforge-review.yml`: keep artifact upload independent of comments and use stable artifact name `aunoforge-report`.
- Create `docs/examples/aunoforge-review.yml`: copyable workflow example where artifact upload is visibly optional.
- Modify `docs/getting-started.md`: explain automatic Step Summary and optional artifact upload without claiming Marketplace or stable v0.2 release availability.
- Create `test/action-artifact-example.test.mjs`: documentation-as-code contract for the optional artifact example.

---

### Task 1: Define the Step Summary contract RED

**Files:**
- Create: `test/action-summary.test.mjs`
- Create later in GREEN: `scripts/action-summary.mjs`

**Interfaces:**
- Produces: `getFindingVerificationCounts(report)` returning `{ verified: number, unverified: number }`.
- Produces: `renderActionStepSummary(options)` returning Markdown ending in exactly one newline.
- `renderActionStepSummary` options shape:

```js
{
  report,
  provider,
  format,
  reportPath,
  commentEnabled,
  allowWrite,
}
```

- [ ] **Step 1: Write the failing unit test**

Create `test/action-summary.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFindingVerificationCounts,
  renderActionStepSummary,
} from '../scripts/action-summary.mjs';

const report = {
  schemaVersion: '1',
  repository: { root: '/repo' },
  findings: [
    {
      id: 'deterministic-1',
      severity: 'high',
      category: 'javascript-eval',
      title: 'Dynamic eval',
      evidence: ['eval(userInput)'],
      explanation: 'Avoid eval.',
      confidence: 1,
      source: 'deterministic',
      location: { file: 'src/app.js', startLine: 7 },
    },
    {
      id: 'model-verified',
      severity: 'medium',
      category: 'regression',
      title: 'Verified regression',
      evidence: ['return false'],
      explanation: 'Behavior changed.',
      confidence: 0.9,
      source: 'model',
      location: { file: 'src/check.js', startLine: 3, verified: true },
    },
    {
      id: 'model-unverified',
      severity: 'low',
      category: 'maintainability',
      title: 'Unverified claim',
      evidence: [],
      explanation: 'Needs inspection.',
      confidence: 0.4,
      source: 'model',
    },
  ],
  summary: { critical: 0, high: 1, medium: 1, low: 1, info: 0 },
  recommendation: 'needs-review',
};

test('finding verification counts treat deterministic and evidence-verified findings as verified', () => {
  assert.deepEqual(getFindingVerificationCounts(report), {
    verified: 2,
    unverified: 1,
  });
});

test('Step Summary is concise, structured, and explicit about write mode', () => {
  const output = renderActionStepSummary({
    report,
    provider: 'mock',
    format: 'markdown',
    reportPath: '/repo/aunoforge-review.md',
    commentEnabled: false,
    allowWrite: false,
  });

  assert.match(output, /^## AunoForge Review/m);
  assert.match(output, /Recommendation \| `needs-review`/);
  assert.match(output, /Provider \| `mock`/);
  assert.match(output, /Mode \| `read-only`/);
  assert.match(output, /Findings \| 2 verified · 1 unverified/);
  assert.match(output, /Critical 0 · High 1 · Medium 1 · Low 1 · Info 0/);
  assert.match(output, /Report \| `aunoforge-review\.md`/);
  assert.match(output, /Repository writes are disabled by default/);
  assert.equal(output.endsWith('\n'), true);
});

test('Step Summary reports explicit PR comment write mode only when both gates are enabled', () => {
  const output = renderActionStepSummary({
    report,
    provider: 'mock',
    format: 'json',
    reportPath: '/repo/aunoforge-review.json',
    commentEnabled: true,
    allowWrite: true,
  });

  assert.match(output, /Mode \| `PR comment write enabled`/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/action-summary.test.mjs
```

Expected: FAIL because `scripts/action-summary.mjs` does not exist.

- [ ] **Step 3: Commit the RED contract only**

```bash
git add test/action-summary.test.mjs
git commit -m "test: define GitHub Step Summary contract"
```

---

### Task 2: Implement the pure summary renderer GREEN

**Files:**
- Create: `scripts/action-summary.mjs`
- Test: `test/action-summary.test.mjs`

**Interfaces:**
- `getFindingVerificationCounts(report)` treats `source === 'deterministic'` as verified, and treats non-deterministic findings as verified only when `location?.verified === true`.
- `renderActionStepSummary(options)` uses only validated report fields and the fixed Action enums; it performs no file/network writes.

- [ ] **Step 1: Add the minimal implementation**

Create `scripts/action-summary.mjs`:

```js
import { basename } from 'node:path';

export function getFindingVerificationCounts(report) {
  let verified = 0;
  let unverified = 0;
  for (const finding of report.findings) {
    if (finding.source === 'deterministic' || finding.location?.verified === true) verified += 1;
    else unverified += 1;
  }
  return { verified, unverified };
}

export function renderActionStepSummary({
  report,
  provider,
  format,
  reportPath,
  commentEnabled,
  allowWrite,
}) {
  const { verified, unverified } = getFindingVerificationCounts(report);
  const mode = commentEnabled && allowWrite ? 'PR comment write enabled' : 'read-only';
  const severity = report.summary;
  return [
    '## AunoForge Review',
    '',
    '| Field | Result |',
    '| --- | --- |',
    `| Recommendation | \`${report.recommendation}\` |`,
    `| Provider | \`${provider}\` |`,
    `| Format | \`${format}\` |`,
    `| Mode | \`${mode}\` |`,
    `| Findings | ${verified} verified · ${unverified} unverified |`,
    `| Severity | Critical ${severity.critical} · High ${severity.high} · Medium ${severity.medium} · Low ${severity.low} · Info ${severity.info} |`,
    `| Report | \`${basename(reportPath)}\` |`,
    '',
    '> Repository writes are disabled by default. PR comments require both `comment=true` and `allow-write=true` plus the required GitHub permission.',
    '',
  ].join('\n');
}
```

- [ ] **Step 2: Run the focused test**

```bash
node --test test/action-summary.test.mjs
```

Expected: PASS, 3 tests, 0 failures.

- [ ] **Step 3: Commit the GREEN helper**

```bash
git add scripts/action-summary.mjs
git commit -m "feat: render GitHub Step Summary"
```

---

### Task 3: Define the packaged Action integration contract RED

**Files:**
- Modify: `test/action-runtime.test.mjs`
- Read: `scripts/action.mjs`

**Interfaces:**
- Consumes: generated `dist/action/index.mjs`.
- Produces: integration evidence that a default read-only Action run appends Step Summary and still writes the requested report format.

- [ ] **Step 1: Extend the existing packaged Action test with a Step Summary file**

In `packaged action resolves its sibling cli when GITHUB_ACTION_PATH is unavailable`, add:

```js
const summaryPath = join(root, 'step-summary.md');
const outputPath = join(root, 'github-output.txt');
```

Add these environment variables:

```js
GITHUB_STEP_SUMMARY: summaryPath,
GITHUB_OUTPUT: outputPath,
```

Change the Action input format in this test from JSON to Markdown:

```js
INPUT_FORMAT: 'markdown',
```

After `assert.equal(result.code, 0, result.stderr);`, assert:

```js
const markdown = await readFile(join(root, 'aunoforge-review.md'), 'utf8');
assert.match(markdown, /^# AunoForge Review/m);
assert.match(markdown, /javascript-eval/);

const summary = await readFile(summaryPath, 'utf8');
assert.match(summary, /^## AunoForge Review/m);
assert.match(summary, /Provider \| `mock`/);
assert.match(summary, /Mode \| `read-only`/);
assert.match(summary, /Report \| `aunoforge-review\.md`/);
assert.match(summary, /High [0-9]+ · Medium [0-9]+/);

const output = await readFile(outputPath, 'utf8');
assert.match(output, /report-path=.*aunoforge-review\.md/);
```

- [ ] **Step 2: Add a no-GitHub-summary compatibility test**

Add a new test that executes the packaged Action with `GITHUB_STEP_SUMMARY: ''`, `INPUT_FORMAT: 'json'`, and otherwise the existing read-only mock environment, then asserts exit code 0 and a valid `aunoforge-review.json` file. This proves local/non-GitHub execution does not fail when Step Summary is unavailable.

- [ ] **Step 3: Run the packaged runtime tests and verify RED**

Run:

```bash
node --test test/action-runtime.test.mjs
```

Expected: the new Step Summary assertion fails because the current packaged Action never writes `GITHUB_STEP_SUMMARY`; existing zero-key CLI smoke remains green.

- [ ] **Step 4: Commit the RED integration contract**

```bash
git add test/action-runtime.test.mjs
git commit -m "test: require Action Step Summary output"
```

---

### Task 4: Make the Action use one canonical review result and emit Step Summary

**Files:**
- Modify: `scripts/action.mjs`
- Consume: `scripts/action-summary.mjs`
- Consume: `@aunoforge/core` `validateReviewReport`
- Consume: `@aunoforge/reporters` `renderJson`, `renderMarkdown`, `renderTerminal`
- Test: `test/action-runtime.test.mjs`

**Interfaces:**
- CLI subprocess is invoked once with `--format json` regardless of requested Action report format.
- Parsed JSON is validated with `validateReviewReport`.
- The validated report is rendered into the user-selected Action format with existing reporter functions.
- The same structured report drives the Step Summary; no second provider call is allowed.

- [ ] **Step 1: Add imports**

At the top of `scripts/action.mjs` add:

```js
import { validateReviewReport } from '@aunoforge/core';
import { renderJson, renderMarkdown, renderTerminal } from '@aunoforge/reporters';
import { renderActionStepSummary } from './action-summary.mjs';
```

- [ ] **Step 2: Keep requested format separate from CLI machine format**

Keep current input validation for `format`, but change the subprocess arguments from:

```js
const args = [cliPath, 'review', '--root', workspace, '--provider', provider, '--format', format];
```

to:

```js
const args = [cliPath, 'review', '--root', workspace, '--provider', provider, '--format', 'json'];
```

- [ ] **Step 3: Stop streaming canonical JSON as final user output**

Inside `runNode`, remove only:

```js
process.stdout.write(chunk);
```

Continue accumulating `stdout` exactly as before.

- [ ] **Step 4: Parse once and render the requested output**

Replace:

```js
const report = await runNode(args);
```

with:

```js
const rawReport = await runNode(args);
const structuredReport = validateReviewReport(JSON.parse(rawReport));
const report = format === 'json'
  ? renderJson(structuredReport)
  : format === 'markdown'
    ? renderMarkdown(structuredReport)
    : renderTerminal(structuredReport);
process.stdout.write(report);
```

Keep the existing extension/report-path/write logic after this block.

- [ ] **Step 5: Append Step Summary when GitHub provides a summary file**

After writing `GITHUB_OUTPUT`, add:

```js
if (process.env.GITHUB_STEP_SUMMARY) {
  const stepSummary = renderActionStepSummary({
    report: structuredReport,
    provider,
    format,
    reportPath,
    commentEnabled: comment,
    allowWrite,
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, 'utf8');
}
```

Do not introduce any GitHub API request for Step Summary.

- [ ] **Step 6: Preserve comment behavior using the requested rendered report**

Do not change the existing `if (comment)` permission gate or comment API call. The comment body continues to use `report`, so Markdown remains Markdown and JSON/terminal remain fenced text.

- [ ] **Step 7: Build and regenerate the packaged runtime**

Run:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm build:action
```

Expected: `dist/action/index.mjs` changes to include core/reporters/summary code; `dist/action/cli.mjs` changes only if the reproducible builder actually produces different bytes.

- [ ] **Step 8: Run the focused summary and packaged Action tests**

```bash
node --test test/action-summary.test.mjs test/action-runtime.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit maintained source and generated runtime together**

```bash
git add scripts/action.mjs scripts/action-summary.mjs dist/action/index.mjs dist/action/cli.mjs
git commit -m "feat: add GitHub Step Summary to Action reviews"
```

If `dist/action/cli.mjs` is byte-identical, do not stage it.

---

### Task 5: Define optional artifact workflow documentation RED

**Files:**
- Create: `test/action-artifact-example.test.mjs`
- Create later in GREEN: `docs/examples/aunoforge-review.yml`
- Modify later in GREEN: `docs/getting-started.md`
- Modify later in GREEN: `.github/workflows/aunoforge-review.yml`

**Interfaces:**
- The copyable example uses `id: aunoforge` and `steps.aunoforge.outputs.report-path`.
- Artifact name is `aunoforge-report`.
- Artifact upload is a separate `actions/upload-artifact@v4` step, not an AunoForge Action capability.
- Commenting remains explicitly false in the example.

- [ ] **Step 1: Write the failing documentation-as-code test**

Create `test/action-artifact-example.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const exampleUrl = new URL('../docs/examples/aunoforge-review.yml', import.meta.url);
const workflowUrl = new URL('../.github/workflows/aunoforge-review.yml', import.meta.url);

test('workflow example keeps artifact upload optional and independent from PR comments', async () => {
  const source = await readFile(exampleUrl, 'utf8');
  assert.match(source, /id:\s+aunoforge/);
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
  assert.match(source, /steps\.aunoforge\.outputs\.report-path/);
  assert.match(source, /optional/i);
});

test('repository smoke workflow uses the stable artifact name without enabling comments', async () => {
  const source = await readFile(workflowUrl, 'utf8');
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test test/action-artifact-example.test.mjs
```

Expected: FAIL because `docs/examples/aunoforge-review.yml` does not exist and the current smoke workflow artifact name is `aunoforge-review`.

- [ ] **Step 3: Commit the RED documentation contract**

```bash
git add test/action-artifact-example.test.mjs
git commit -m "test: define optional report artifact workflow"
```

---

### Task 6: Add the optional artifact example and docs GREEN

**Files:**
- Create: `docs/examples/aunoforge-review.yml`
- Modify: `.github/workflows/aunoforge-review.yml`
- Modify: `docs/getting-started.md`
- Test: `test/action-artifact-example.test.mjs`

**Interfaces:**
- Example is copyable and safe by default.
- Artifact step is marked optional in its step name/comment; removing it does not affect AunoForge review execution or Step Summary.

- [ ] **Step 1: Create the maintained example**

Create `docs/examples/aunoforge-review.yml`:

```yaml
name: AunoForge Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  issues: read
  pull-requests: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dhtoan/AunoForge@main
        id: aunoforge
        with:
          command: review
          provider: mock
          format: markdown
          comment: 'false'

      # Optional: persist the generated report. Step Summary works without this.
      - name: Upload AunoForge report (optional)
        uses: actions/upload-artifact@v4
        with:
          name: aunoforge-report
          path: ${{ steps.aunoforge.outputs.report-path }}
          if-no-files-found: error
```

Keep `@main` here for Phase 1 because changing public examples to a stable release tag belongs to the separately approved 60-second-proof/stable-tag milestone.

- [ ] **Step 2: Align the repository smoke artifact name**

In `.github/workflows/aunoforge-review.yml`, change only:

```yaml
name: aunoforge-review
```

to:

```yaml
name: aunoforge-report
```

Keep both existing report paths and both `comment: 'false'` Action invocations.

- [ ] **Step 3: Add a concise getting-started section**

Append to `docs/getting-started.md`:

```markdown
## GitHub Actions result surfaces

AunoForge writes a GitHub Step Summary automatically when it runs as a GitHub Action. The summary includes the recommendation, provider, verified/unverified finding counts, severity counts, report format, and report file name. Step Summary needs no additional repository write permission.

The full report remains available through the Action's `report-path` output. Artifact upload is optional and stays at the workflow layer with GitHub's maintained `actions/upload-artifact@v4`; it does not require enabling AunoForge PR comments. See [`examples/aunoforge-review.yml`](examples/aunoforge-review.yml).
```

- [ ] **Step 4: Run the documentation contract test**

```bash
node --test test/action-artifact-example.test.mjs
```

Expected: PASS, 2 tests, 0 failures.

- [ ] **Step 5: Commit the workflow/docs change**

```bash
git add docs/examples/aunoforge-review.yml docs/getting-started.md .github/workflows/aunoforge-review.yml
git commit -m "docs: add optional AunoForge report artifact workflow"
```

---

### Task 7: Rebuild and run the complete verification gate

**Files:**
- Verify all repository source and generated runtime.
- Do not modify unrelated files.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: local/reproducible evidence before opening the primary Phase 1 PR.

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Expected: exit 0.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run complete tests**

```bash
pnpm test
```

Expected: exit 0, zero failures, including Step Summary and optional artifact contracts.

- [ ] **Step 4: Run normal build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Prove generated-runtime reproducibility**

```bash
pnpm build:action
git diff --exit-code -- dist/action
test -z "$(git status --porcelain --untracked-files=all -- dist/action)"
```

Expected: exit 0 with no generated-runtime drift.

- [ ] **Step 6: Inspect final diff**

```bash
git status --short
git diff --stat main...HEAD
```

Expected: only files justified by this Phase 1 plan; no temporary workflows, credentials, generated logs, audit logs, or unrelated changes.

---

### Task 8: Open one Phase 1 PR and use GitHub CI as integration proof

**Files:**
- Branch: `feat/v0.2-step-summary-artifact`
- Base: `main`
- Existing workflows: `.github/workflows/ci.yml`, `.github/workflows/aunoforge-review.yml`

**Interfaces:**
- Produces: the single primary upgrade PR for Phase 1.

- [ ] **Step 1: Open the PR only after Task 7 is green**

PR title:

```text
feat: add GitHub Step Summary and optional report artifact
```

PR body must state:

```markdown
## Goal

Make AunoForge review results immediately visible in GitHub Actions through Step Summary while keeping full report artifacts optional and workflow-owned.

## Safety

- read-only remains the default
- Step Summary needs no extra token permission
- artifact upload uses actions/upload-artifact@v4 outside AunoForge core
- PR comments remain disabled unless explicitly enabled with the existing write gates
- provider review executes once per Action run
```

Include actual RED/GREEN and verification evidence; do not claim CI success before current-head CI completes.

- [ ] **Step 2: Verify the `AunoForge Review` workflow on the PR head**

Required behavior:

```text
mock Markdown Action run succeeds via uses: ./
mock JSON Action run succeeds via uses: ./
artifact upload succeeds under name aunoforge-report
both report-path outputs remain valid
no PR comment is written
```

The runtime integration tests are the deterministic proof of the Step Summary file contents; GitHub workflow success proves the packaged Action runs under the Node 24 host.

- [ ] **Step 3: Verify the CI matrix**

Required successful jobs:

```text
Node 20 quality
Node 22 quality
Node 24 quality
generated-runtime drift check in each quality job
macOS platform smoke
Windows platform smoke
```

- [ ] **Step 4: Update the PR body after current-head CI is green**

Record the exact current head SHA and successful checks. Do not use results from an older head.

- [ ] **Step 5: Stop at the human merge gate**

Do not auto-merge. Do not begin the structured SARIF/GitHub reporter Phase 2 implementation while this PR remains the primary open upgrade PR.

---

## Self-review result

- **Spec coverage:** This plan covers Phase 1 only: default GitHub Step Summary, status/recommendation, provider/mode, verified/unverified counts, severity counts, report location, optional workflow-owned artifact upload, JSON machine-consumability, unchanged `report-path`, no new write permission, and single provider invocation. SARIF/annotations remain Phase 2.
- **Placeholder scan:** No `TBD`, `TODO`, unspecified validation step, or deferred implementation placeholder remains.
- **Type/interface consistency:** The Action consumes a validated canonical `ReviewReport`, uses the existing reporter functions for all three current output formats, and passes that same report to the pure summary helper. Artifact upload consumes the existing `report-path` output and does not add an AunoForge runtime permission.
- **Controlled-train check:** PR #10 is merged; this branch may become the next single primary upgrade PR after verification. No auto-merge is authorized.
