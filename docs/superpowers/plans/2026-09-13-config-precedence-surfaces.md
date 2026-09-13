# Configuration Precedence Across CLI and Action Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Phase 6 precedence contract consistently to `review`, `release`, `security`, and GitHub Action format selection without weakening runtime-only write/credential boundaries or changing established command defaults.

**Architecture:** Keep `.aunoforge/config.json` as the single project-config source and extend the existing resolver with an explicit per-surface built-in default. CLI commands resolve format through that shared path; `review` keeps explicit SARIF as a command-only override. The GitHub Action distinguishes omitted format input from an explicit input so project config can participate before the Action's own fallback.

**Tech Stack:** TypeScript CLI, Node.js ESM Action runtime, Node test runner, pnpm workspace, esbuild generated Action bundle.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md`

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge; human merge remains mandatory.
- Read-only behavior remains the default.
- Any GitHub write requires explicit configuration and the minimum required permission.
- Fork-originated pull requests must never gain an implicit write path.
- Provider credentials stay runtime-only.
- Deterministic/mock mode remains a first-class zero-key path.
- Non-security-sensitive precedence is exactly `explicit CLI/action input > .aunoforge/config.json > built-in preset > built-in default`.
- `allow-write`, credentials, tokens, and secrets remain excluded from config/preset inheritance.
- Preserve existing defaults when no config/input exists: CLI review `terminal`, CLI release `markdown`, CLI security `terminal`, Action review `markdown`, Action security `terminal`.
- Explicit review `sarif` remains supported and must beat project config.
- Behavior changes use RED -> GREEN TDD.
- Before completion, require lint, typecheck, tests, build, generated Action runtime drift verification, recipes validation, macOS/Windows platform smoke, PR CI, and AunoForge Review.

---

### Task 1: Make the shared config resolver accept a per-surface built-in default

**Files:**
- Modify: `packages/cli/src/config.ts`
- Test: `packages/cli/test/config.test.mjs`

**Interfaces:**
- Consumes: `AunoForgeProjectConfig`, `ResolvedAunoForgeConfig`, existing preset table.
- Produces: `resolveProjectConfig(config, overrides?, defaults?)` and `resolveRuntimeConfig(root, overrides?, defaults?)`.

- [ ] **Step 1: Write the failing resolver test**

```js
test('surface defaults are lowest precedence and do not override preset config or explicit format',()=>{
  const bare=validateProjectConfig({schemaVersion:1});
  assert.equal(resolveProjectConfig(bare,{}, {format:'markdown'}).format,'markdown');
  const preset=validateProjectConfig({schemaVersion:1,extends:'security'});
  assert.equal(resolveProjectConfig(preset,{}, {format:'markdown'}).format,'json');
  const configured=validateProjectConfig({schemaVersion:1,extends:'security',format:'terminal'});
  assert.equal(resolveProjectConfig(configured,{}, {format:'markdown'}).format,'terminal');
  assert.equal(resolveProjectConfig(configured,{format:'json'},{format:'markdown'}).format,'json');
});
```

- [ ] **Step 2: Run the focused test and prove RED**

Run the CLI package tests. Expected: FAIL because the resolver does not yet support a third defaults argument.

- [ ] **Step 3: Write minimal implementation**

Add `ConfigDefaults = Partial<Pick<ResolvedAunoForgeConfig, "format">>` and resolve format as:

```ts
format: overrides.format ?? config.format ?? presetFormat ?? defaults.format ?? "terminal"
```

Forward `defaults` through `resolveRuntimeConfig`.

- [ ] **Step 4: Run the focused tests and prove GREEN**

Expected: all config tests pass.

- [ ] **Step 5: Commit**

`feat: support surface-specific config defaults`

---

### Task 2: Apply config precedence to review, release, and security CLI commands

**Files:**
- Modify: `packages/cli/src/app.ts`
- Test: `packages/cli/test/app-smoke.test.mjs`

**Interfaces:**
- Consumes: `resolveRuntimeConfig(root, overrides, defaults)` from Task 1.
- Produces: command-local effective formats with unchanged explicit-format validation and established defaults.

- [ ] **Step 1: Write RED tests for all three CLI surfaces**

Cover:
- config `format:'json'` + review without `--format` -> JSON;
- explicit review Markdown beats config;
- explicit review SARIF beats config;
- config `format:'json'` + release without `--format` -> JSON;
- release without config remains Markdown;
- config `format:'json'` + security without `--format` -> JSON;
- config `format:'markdown'` + security without explicit format fails clearly;
- explicit security JSON beats an incompatible configured Markdown value.

- [ ] **Step 2: Run tests and prove RED**

Expected: new precedence cases fail because these commands still bypass `resolveRuntimeConfig`.

- [ ] **Step 3: Write minimal implementation**

For review, preserve explicit SARIF as the top-priority runtime-only format; otherwise resolve terminal/markdown/json through project config with CLI default terminal. For release use CLI default Markdown. For security use CLI default terminal, then reject resolved Markdown clearly.

- [ ] **Step 4: Run focused tests and prove GREEN**

Expected: new tests and legacy defaults pass.

- [ ] **Step 5: Commit**

`feat: apply project config across CLI surfaces`

---

### Task 3: Apply config precedence to GitHub Action format selection

**Files:**
- Modify: `action.yml`
- Modify: `scripts/action.mjs`
- Test: `test/action-manifest.test.mjs`
- Test: `test/action-runtime.test.mjs`

**Interfaces:**
- Produces Action precedence `explicit INPUT_FORMAT > project config > preset > Action default`.

- [ ] **Step 1: Write RED manifest/runtime tests**

Cover:
- `action.yml` format default is empty so omission is observable;
- review + project config JSON + omitted input writes `.json`;
- explicit Markdown beats config JSON;
- no config + omitted review stays Markdown;
- no config + omitted security stays terminal;
- security + config JSON + omitted input writes JSON;
- explicit SARIF review beats config.

- [ ] **Step 2: Run tests and prove RED**

Expected: failures because Action currently sets `INPUT_FORMAT || 'markdown'` and manifest supplies Markdown automatically.

- [ ] **Step 3: Write minimal implementation**

Keep `formatInput` raw. If explicit review SARIF is present, use it directly. Otherwise resolve project config with Action default `markdown` for review and `terminal` for security. Validate the final format per command. Do not alter comment/write/token/fork boundaries.

- [ ] **Step 4: Run source tests and prove GREEN**

Expected: source/runtime contract tests pass except expected generated-runtime drift.

- [ ] **Step 5: Commit**

`feat: apply config precedence to action format`

---

### Task 4: Document precedence and refresh packaged runtime

**Files:**
- Modify: `docs/commands/config.md`
- Modify: `test/configuration-presets-docs.test.mjs`
- Generated: `dist/action/cli.mjs`
- Generated: `dist/action/index.mjs`

**Interfaces:**
- Documents exact runtime behavior from Tasks 1-3.
- Generated files must come only from `pnpm build:action` on the exact maintained source head.

- [ ] **Step 1: Write docs contract RED test**

Require docs to mention review/release/security/Action precedence, command-specific defaults, SARIF override, and that write permission/credentials never inherit.

- [ ] **Step 2: Run docs test and prove RED**

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update docs**

Document defaults: CLI review terminal, CLI release Markdown, CLI security terminal, Action review Markdown, Action security terminal. Document incompatible configured Markdown for security and explicit supported override behavior.

- [ ] **Step 4: Run source verification**

Expected: source tests green; generated-runtime drift may identify only the expected bundles.

- [ ] **Step 5: Regenerate checked-in Action runtime**

Use the established temporary helper workflow from the exact source head with Node 24, pnpm 10.15.1, frozen install, `pnpm build:action`, strict generated-drift assertion, immediate helper-workflow removal, and no helper PR.

- [ ] **Step 6: Run final exact-head verification**

Require Node 20/22/24 quality, packaged Action verification, recipes, macOS/Windows smoke, PR CI, AunoForge Review, no unresolved review threads, and exactly one primary PR.

- [ ] **Step 7: Open the single primary PR**

Title: `feat: apply configuration precedence across runtime surfaces`

Body must include RED/GREEN evidence, generated-runtime provenance, exact-head CI evidence, unchanged security boundaries, and `human merge required; no auto-merge`.
