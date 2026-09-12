# Incremental Evidence Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic finding fingerprints and offline baseline comparison so maintainers can distinguish new, persistent, resolved, and regressed findings without changing AunoForge's read-only trust model.

**Architecture:** Keep the existing `ReviewReport` as the complete raw current snapshot. Add a focused comparison module in `@aunoforge/core` that computes semantic fingerprints and comparison state from validated review snapshots, then thread optional comparison metadata through the CLI/Action presentation layer only when an explicit baseline JSON path is supplied. The comparison engine has no network or persistence dependency; workflow artifact download/storage remains outside core.

**Tech Stack:** TypeScript 5.8, Node.js 20+ local CLI, Node 24 GitHub Action host runtime, Node built-in `crypto`, Node test runner, pnpm 10.15.1.

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
- Fingerprint inputs are exactly normalized repository-relative file path, stable category/rule identifier, and normalized evidence anchor or line neighborhood.
- Severity and explanation prose are not fingerprint inputs.
- Severity ordering for regression comparison is `low < medium < high < critical`; `info` is treated below `low` for implementation ordering without changing the spec's qualifying regression threshold.
- Core stores no baseline remotely.

---

### Task 1: Stable semantic finding fingerprints

**Files:**
- Create: `packages/core/src/comparison.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/comparison.test.mjs`

**Interfaces:**
- Produces: `normalizeFindingPath(path: string): string`
- Produces: `normalizeEvidenceAnchor(finding: Finding): string`
- Produces: `fingerprintFinding(finding: Finding): string`
- Fingerprint format: `af1:<64 lowercase hex sha256>`

- [ ] **Step 1: Write failing fingerprint tests** covering path separator normalization, leading `./` normalization, category normalization, stable evidence whitespace normalization, explanation/severity independence, and evidence/location identity changes.
- [ ] **Step 2: Run `npm run build && node --test packages/core/test/comparison.test.mjs` and verify RED** because the comparison exports do not exist.
- [ ] **Step 3: Implement minimal deterministic fingerprinting** using SHA-256 over a canonical JSON tuple `[normalizedPath, normalizedCategory, normalizedAnchor]`.
- [ ] **Step 4: Export the comparison helpers from `packages/core/src/index.ts`.**
- [ ] **Step 5: Re-run the focused test and verify GREEN.**
- [ ] **Step 6: Run `npm run lint`, `npm run typecheck`, and the full core test set.**
- [ ] **Step 7: Commit the tested fingerprint slice.**

Fingerprint anchor rules for this phase:

```text
verified/located finding -> normalized evidence text when present, plus a normalized line span token
unlocated finding        -> normalized evidence text
empty evidence           -> normalized line span token when present, otherwise `unanchored`
```

Evidence normalization lowercases, trims, converts CRLF to LF, collapses horizontal whitespace, removes blank edge lines, and preserves evidence item order. This intentionally avoids title/explanation prose while remaining deterministic for equivalent evidence.

### Task 2: Offline comparison states

**Files:**
- Modify: `packages/core/src/comparison.ts`
- Modify: `packages/core/src/contracts.ts`
- Modify: `packages/core/src/index.ts`
- Extend: `packages/core/test/comparison.test.mjs`

**Interfaces:**

```ts
export type FindingState = "new" | "persistent" | "resolved" | "regressed";

export type ComparedFinding = {
  fingerprint: string;
  state: Exclude<FindingState, "resolved">;
  current: Finding;
  baseline?: Finding;
};

export type ResolvedFinding = {
  fingerprint: string;
  state: "resolved";
  baseline: Finding;
};

export type ReviewComparison = {
  current: ComparedFinding[];
  resolved: ResolvedFinding[];
  counts: Record<FindingState, number>;
};

export function compareReviewReports(baseline: ReviewReport, current: ReviewReport): ReviewComparison;
```

- [ ] **Step 1: Write failing fixtures** for new, persistent, resolved, and severity-regressed findings.
- [ ] **Step 2: Prove RED with the focused comparison test.**
- [ ] **Step 3: Implement matching by fingerprint and verified severity increase detection.** A severity increase only qualifies as `regressed` when the current finding is evidence-verified (`source === "deterministic"` or `location.verified === true`).
- [ ] **Step 4: Add deterministic ordering**: current findings retain current report order; resolved findings retain baseline order.
- [ ] **Step 5: Verify GREEN and full core quality.**
- [ ] **Step 6: Commit.**

Returning-after-resolved history is represented additively in Task 3 baseline metadata rather than inferred from two raw snapshots, because two snapshots alone cannot prove that a fingerprint was resolved in an earlier intermediate run.

### Task 3: Versioned incremental JSON envelope and baseline loading

**Files:**
- Modify: `packages/core/src/contracts.ts`
- Modify: `packages/core/src/comparison.ts`
- Modify: `packages/cli/src/app.ts`
- Modify: `packages/cli/src/review.ts`
- Extend: `packages/cli/test/app-smoke.test.mjs`
- Create: `packages/cli/test/fixtures/review-baseline.json`

**Interfaces:**

```ts
export type IncrementalMetadata = {
  schemaVersion: "1";
  comparison: ReviewComparison;
  resolvedHistory: string[];
};

export type IncrementalReviewReport = ReviewReport & {
  incremental?: IncrementalMetadata;
};
```

CLI contract:

```text
aunoforge review ... --baseline <path-to-aunoforge-json>
```

- [ ] **Step 1: Write failing CLI tests** proving `--baseline` loads only local JSON, rejects malformed/non-review JSON clearly, and leaves no-baseline JSON behavior unchanged.
- [ ] **Step 2: Prove RED.**
- [ ] **Step 3: Load and validate the baseline with `validateReviewReport`, compute comparison, and attach optional incremental metadata to presentation output.**
- [ ] **Step 4: Carry `resolvedHistory` forward so a fingerprint absent in the baseline current set but present in prior resolved history becomes `regressed` when it returns.**
- [ ] **Step 5: Verify offline operation with two fixture files and no GitHub/provider network requirement beyond the current review invocation itself.**
- [ ] **Step 6: Commit.**

### Task 4: Incremental Markdown/terminal presentation

**Files:**
- Modify: `packages/reporters/src/reporter.ts`
- Modify: `packages/reporters/src/markdown.ts`
- Modify: `packages/reporters/src/terminal.ts`
- Extend: `packages/reporters/test/reporters.test.mjs`

**Interfaces:**
- `renderReport` continues to accept raw `ReviewReport`; add an optional third argument `{ comparison?: ReviewComparison }` rather than making reporters compute matching.
- JSON raw review fields stay complete; comparison metadata is additive only when a baseline was supplied.

- [ ] **Step 1: Add RED tests** that Markdown/terminal lead with new and regressed counts, keep persistent findings secondary, and summarize resolved findings without claiming correctness.
- [ ] **Step 2: Implement minimal presentation changes.**
- [ ] **Step 3: Verify existing no-baseline snapshots/expectations remain unchanged where practical.**
- [ ] **Step 4: Run reporter tests and commit.**

### Task 5: GitHub Action explicit baseline input and Step Summary

**Files:**
- Modify: `action.yml`
- Modify: `scripts/action.mjs`
- Modify: `scripts/action-summary.mjs`
- Modify: `scripts/build-action.mjs` only if generated entry wiring requires it
- Regenerate: `dist/action/index.mjs`
- Regenerate: `dist/action/cli.mjs` only if CLI bundle changes
- Extend: `test/action-manifest.test.mjs`
- Extend: `test/action-summary.test.mjs`
- Extend: `test/action-runtime.test.mjs`

**Interfaces:**
- New optional Action input: `baseline`, a local JSON path supplied by workflow authors.
- No automatic artifact download, Checks API write, PR comment, or remote state lookup.

- [ ] **Step 1: Add RED manifest/runtime/summary tests.**
- [ ] **Step 2: Add optional `baseline` input and pass it to the CLI only when non-empty.**
- [ ] **Step 3: Make Step Summary lead with `new` and `regressed`, then persistent/resolved counts when comparison metadata exists.**
- [ ] **Step 4: Regenerate the Node 24 runtime reproducibly and run drift checks.**
- [ ] **Step 5: Run focused Action tests and commit.**

### Task 6: Maintained workflow example and documentation

**Files:**
- Modify: `docs/examples/aunoforge-review.yml`
- Modify: `docs/getting-started.md`
- Modify: `.github/workflows/aunoforge-review.yml` only if a deterministic repository-owned baseline fixture can exercise the path without remote state orchestration
- Extend: `test/action-artifact-example.test.mjs`
- Extend documentation/link tests as needed

- [ ] **Step 1: Add RED documentation-as-code assertions** for the explicit local baseline contract and no automatic previous-artifact lookup.
- [ ] **Step 2: Document a copyable workflow pattern in which baseline acquisition is a separate workflow concern.**
- [ ] **Step 3: State that AunoForge core stores no baseline remotely and repository writes remain disabled by default.**
- [ ] **Step 4: Run documentation tests and commit.**

### Task 7: Final Phase 3 verification gate

**Files:** No new behavior unless verification exposes a real defect.

- [ ] **Step 1: Run `pnpm install --frozen-lockfile`.**
- [ ] **Step 2: Run `pnpm lint`.**
- [ ] **Step 3: Run `pnpm typecheck`.**
- [ ] **Step 4: Run `pnpm test`.**
- [ ] **Step 5: Run `pnpm build`.**
- [ ] **Step 6: Run generated Action runtime drift verification.**
- [ ] **Step 7: Confirm maintained GitHub workflows preserve read-only permissions and no auto-merge/write path was introduced.**
- [ ] **Step 8: Require PR-triggered CI and AunoForge Review to pass before calling Phase 3 complete.**
- [ ] **Step 9: Keep human merge mandatory before Phase 4.**
