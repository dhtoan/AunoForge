# Phase 5 Release Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `aunoforge release` into deterministic, evidence-backed release intelligence with stable categories, semantic-version guidance, contributor attribution, JSON output, and a read-only dry-run workflow.

**Architecture:** Keep release intelligence in the CLI package because the existing release reader, Git-log parser, and command surface already live there. Introduce a normalized release dataset first, render Markdown/JSON from that dataset second, and keep optional GitHub enrichment behind the existing read-only `ReleaseReader`. Classification and semantic-version decisions are deterministic; model providers do not decide source facts.

**Tech Stack:** TypeScript, Node.js built-in test runner, Git, existing `@aunoforge/github` read-only adapter, pnpm workspace, checked-in Action runtime verification where applicable.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md` — Phase 5 Release Intelligence.

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge; human merge is mandatory.
- Read-only behavior remains the default.
- `aunoforge release` must not create a GitHub release, tag, package publish, branch push, comment, or other repository mutation.
- Deterministic source facts drive category, semantic-version guidance, and contributor identity.
- Evidence precedence is: configured labels/rules, then conventional commit or configured title patterns, then deterministic fallback `Maintenance`.
- Semantic-version precedence is: any verified `Breaking` change -> `major`; otherwise any verified `Features` change -> `minor`; otherwise release-worthy `Fixes`, `Security`, or `Maintenance` changes -> `patch`.
- First-time contributor claims are emitted only when repository evidence proves them.
- Behavior changes use RED -> GREEN test-first development.
- Relevant lint, typecheck, tests, build, generated runtime drift checks, platform smoke, GitHub CI, and AunoForge Review must pass before Phase 5 is called complete.

---

### Task 1: Deterministic release dataset and semantic-version guidance

**Files:**
- Modify: `packages/cli/src/release.ts`
- Modify: `packages/cli/test/release.test.mjs`

**Interfaces:**
- Consumes: existing `getGitLog(root, from?)` and conventional commit metadata.
- Produces: `ReleaseCategory`, `ReleaseChange`, `ReleaseDataset`, and `ReleaseNotesResult.dataset` with a deterministic `recommendedBump` of `major | minor | patch | none`.

- [ ] **Step 1: Write the failing tests**

Add focused tests that create isolated Git fixtures and assert:

```js
assert.equal(result.dataset.recommendedBump, 'minor');
assert.deepEqual(result.dataset.categories.Features.map((change) => change.title), ['add django recipe']);
assert.deepEqual(result.dataset.categories.Fixes.map((change) => change.title), ['prevent player resize']);
assert.deepEqual(result.dataset.categories.Security.map((change) => change.title), ['harden redirect validation']);
```

Add a breaking commit fixture such as `feat!: remove legacy API` and assert `recommendedBump === 'major'`. Add a maintenance-only fixture and assert `recommendedBump === 'patch'`. Preserve deterministic ordering from Git history.

- [ ] **Step 2: Run the focused test and prove RED**

Run through CI or locally:

```bash
pnpm test
```

Expected: release tests fail because `ReleaseNotesResult` has no normalized dataset or semantic-version recommendation yet; unrelated tests remain green.

- [ ] **Step 3: Implement the minimal deterministic dataset**

In `packages/cli/src/release.ts`, add:

```ts
export type ReleaseCategory = "Features" | "Fixes" | "Security" | "Breaking" | "Maintenance";
export type RecommendedBump = "major" | "minor" | "patch" | "none";
export type ReleaseChange = {
  category: ReleaseCategory;
  title: string;
  source: "commit" | "pull-request";
  commit?: string;
  pullRequest?: number;
  author?: string;
  evidence: string;
};
export type ReleaseDataset = {
  categories: Record<ReleaseCategory, ReleaseChange[]>;
  recommendedBump: RecommendedBump;
  contributors: string[];
};
```

Map commit prefixes deterministically:
- `feat` -> `Features`
- `fix` -> `Fixes`
- `security` -> `Security`
- `!` or `BREAKING CHANGE:` -> `Breaking` and force `major`
- everything else -> `Maintenance`

For a breaking feature/fix, represent the change in `Breaking` rather than double-counting it in two categories. Compute bump from the normalized category evidence only.

- [ ] **Step 4: Run focused and full tests**

```bash
pnpm test
```

Expected: Task 1 release tests pass with deterministic category arrays and bump recommendation; no unrelated regression.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/release.ts packages/cli/test/release.test.mjs
git commit -m "feat: add deterministic release intelligence dataset"
```

---

### Task 2: Pull-request label precedence and contributor evidence

**Files:**
- Modify: `packages/cli/src/release.ts`
- Modify: `packages/cli/test/release.test.mjs`
- Modify if needed: `packages/github/src/index.ts`
- Test if modified: `packages/github/test/*.test.mjs`

**Interfaces:**
- Consumes: existing `ReleaseReader.listMergedPullRequestsSince()` normalized PR metadata: number, title, body, labels, mergedAt, author, breaking.
- Produces: normalized PR `ReleaseChange` records and contributor evidence merged into the same `ReleaseDataset`.

- [ ] **Step 1: Write failing tests for evidence precedence**

Create a fixture PR whose title says `fix:` but label proves `feature`, and assert the configured/deterministic label rule wins. Cover labels for `breaking`, `feature`, `fix`, `security`, and `maintenance`; when no recognized label exists, fall back to title pattern, then `Maintenance`.

Example assertion:

```js
assert.equal(result.dataset.categories.Features[0].pullRequest, 8);
assert.equal(result.dataset.categories.Features[0].evidence, 'label:feature');
```

Add contributor assertions that only the explicit repository author is emitted. Do not claim first-time contributor status without a new reader method and deterministic repository-history evidence.

- [ ] **Step 2: Prove RED**

```bash
pnpm test
```

Expected: PR classification currently appears only in a generic Markdown section and does not populate the normalized category dataset with label precedence.

- [ ] **Step 3: Implement label/title/fallback classification**

Use stable case-insensitive recognized labels. Preserve explicit evidence strings such as `label:security`, `title:feat`, or `fallback:maintenance`. Merge PR contributors into a sorted unique contributor list.

Do not infer first-time contributor status in this task. If repository evidence is not present, omit that field entirely.

- [ ] **Step 4: Verify**

```bash
pnpm test
pnpm typecheck
```

Expected: all release and GitHub-reader tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/release.ts packages/cli/test/release.test.mjs packages/github
git commit -m "feat: classify release pull requests from repository evidence"
```

---

### Task 3: JSON output and explicit dry-run CLI contract

**Files:**
- Modify: `packages/cli/src/app.ts`
- Modify: `packages/cli/src/release.ts`
- Modify: `packages/cli/test/app-smoke.test.mjs`
- Modify: `packages/cli/test/release.test.mjs`

**Interfaces:**
- Consumes: `ReleaseDataset` from Tasks 1-2.
- Produces: `renderRelease(result, format)` for `markdown | json | terminal` and CLI support for `--format` plus documented `--dry-run` read-only semantics.

- [ ] **Step 1: Write failing CLI tests**

Assert:

```text
aunoforge release --root <fixture> --from v0.1.0 --format json --dry-run
```

returns valid JSON containing:
- `recommendedBump`
- category arrays
- contributor list
- evidence for each change
- no publish/write result.

Also assert unsupported release format fails clearly and `--dry-run` does not create tags, commits, files, or remote writes.

- [ ] **Step 2: Prove RED**

```bash
pnpm test
```

Expected: current CLI always prints Markdown and has no release-format/dry-run contract.

- [ ] **Step 3: Implement minimal rendering and argument parsing**

Add release-specific format parsing so review/security behavior is untouched. `--dry-run` is accepted as the safe documented mode and is behaviorally read-only; because release is already read-only, omitting `--dry-run` must still not authorize publication.

JSON must serialize the normalized deterministic dataset rather than scraping Markdown.

- [ ] **Step 4: Verify**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. If CLI source changes produce packaged Action runtime drift, regenerate only the generated file(s) proven by `pnpm build:action` and re-run the full gate.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/app.ts packages/cli/src/release.ts packages/cli/test
git commit -m "feat: expose release intelligence formats and dry run"
```

---

### Task 4: Maintained docs, examples, and Phase 5 verification gate

**Files:**
- Modify: `docs/commands/release.md`
- Create or modify: release documentation-as-code tests under `test/`
- Modify only if required by public runtime: `dist/action/*.mjs`

**Interfaces:**
- Consumes: stable CLI contract from Task 3.
- Produces: maintained copy-paste examples and verification evidence for the Phase 5 PR.

- [ ] **Step 1: Write docs-as-code RED tests**

Require the maintained release docs to contain:
- `--dry-run`
- `--format json`
- the five canonical categories `Features`, `Fixes`, `Security`, `Breaking`, `Maintenance`
- semantic-version guidance `patch`, `minor`, `major`
- an explicit statement that the command does not publish a GitHub release or package.

- [ ] **Step 2: Prove RED**

```bash
pnpm test
```

Expected: existing short release docs do not satisfy the Phase 5 contract.

- [ ] **Step 3: Update docs minimally**

Document deterministic evidence precedence, semver precedence, contributor evidence boundaries, JSON output, and safe dry-run usage. Do not imply first-time contributor detection unless deterministic repository evidence is actually implemented and tested.

- [ ] **Step 4: Run full verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:action
git diff --exit-code -- dist/action
```

Then require GitHub CI on Node 20/22/24, builtin recipe validation, macOS smoke, Windows smoke, and AunoForge Review to complete successfully on the exact PR head.

- [ ] **Step 5: Final PR gate**

Update the primary Phase 5 PR with RED/GREEN evidence, exact-head run IDs, generated-runtime evidence if applicable, and current review/thread state. Mark ready only after every gate is green. Human merge is required; do not auto-merge.
