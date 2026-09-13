# Phase 6 Configuration Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned `.aunoforge/config.json` contract, deterministic built-in presets, safe precedence resolution, and `aunoforge config validate` without allowing configuration to grant write permissions or inject provider credentials.

**Architecture:** Keep configuration parsing and preset resolution in a focused CLI-side module that returns a normalized read-only configuration object. The CLI consumes the resolved configuration but runtime-only write authorization remains outside config resolution. Validation is deterministic and offline; built-in presets are static data, `extends` accepts built-in preset IDs only, and unknown security-sensitive keys fail closed.

**Tech Stack:** TypeScript, Node.js built-in test runner, pnpm workspace, existing CLI package and GitHub Action runtime drift checks.

**Spec:** `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md` — Phase 6 Configuration Presets.

## Global Constraints

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge; human merge is mandatory.
- Project configuration path is exactly `.aunoforge/config.json`.
- First schema requires `schemaVersion: 1`.
- Built-in presets are exactly `recommended`, `minimal`, `strict`, `security`, `node`, `python`, `wordpress`.
- `extends` may reference built-in presets only; no remote preset fetching.
- Non-security-sensitive precedence is `explicit CLI/action input > project config > built-in preset > built-in default`.
- Write-enabling settings such as `allow-write` must never be inherited from config/presets and still require explicit runtime authorization.
- Presets/config must not inject provider credentials.
- Unknown security-sensitive keys fail closed.
- Behavior changes use RED -> GREEN TDD.
- Full lint, typecheck, tests, build, generated Action runtime drift, Node 20/22/24, recipes, macOS/Windows smoke, AunoForge Review, and review-thread gates are required before milestone completion.

---

### Task 1: Versioned config schema and built-in preset resolver

**Files:**
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/test/config.test.mjs`

**Interfaces:**
- Produces `BuiltinPresetId`, `AunoForgeProjectConfig`, `ResolvedAunoForgeConfig`, `loadProjectConfig(root)`, `validateProjectConfig(value)`, and `resolveProjectConfig(config, overrides?)`.
- Presets are static deterministic objects and contain no credentials or write-enabling fields.

- [x] **Step 1: Write failing tests** for required `schemaVersion: 1`, all seven built-in preset IDs, built-in-only `extends`, deterministic resolution, unknown-field rejection, and rejection of config keys that attempt to enable writes or inject credentials.
- [x] **Step 2: Prove RED** with `pnpm test`.
- [x] **Step 3: Implement the minimal parser/resolver** with explicit allowlists and safe defaults.
- [x] **Step 4: Verify** with `pnpm test` and `pnpm typecheck`.
- [x] **Step 5: Commit** as `feat: add versioned configuration presets`.

---

### Task 2: CLI `config validate` contract

**Files:**
- Modify: `packages/cli/src/app.ts`
- Modify: `packages/cli/test/app-smoke.test.mjs`
- Modify: `packages/cli/src/config.ts`

**Interfaces:**
- Consumes `loadProjectConfig`/validation from Task 1.
- Produces `aunoforge config validate --root <repo>` with deterministic JSON/terminal-safe validation output and non-zero status for invalid config.

- [x] **Step 1: Write failing CLI tests** covering valid config, missing/invalid schema version, unknown fields, invalid preset, and forbidden write/credential settings.
- [x] **Step 2: Prove RED** with `pnpm test`.
- [x] **Step 3: Implement minimal command routing** without changing unrelated command semantics.
- [x] **Step 4: Verify** lint/typecheck/tests/build.
- [x] **Step 5: Commit** as `feat: add config validation command`.

---

### Task 3: Safe configuration precedence for read-only runtime settings

**Files:**
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/app.ts`
- Modify: focused CLI tests.

**Interfaces:**
- Applies only non-security-sensitive settings that already exist in the runtime, such as reporter format/threshold-style defaults where supported.
- Explicit invocation flags remain highest precedence.
- `allow-write`, tokens, API keys, and credentials are excluded from resolution entirely.

- [x] **Step 1: Add RED precedence tests** proving CLI > config > preset > default and proving config cannot authorize writes.
- [x] **Step 2: Prove RED**.
- [x] **Step 3: Implement only the minimal shared resolution needed by existing commands**; do not broaden scope into unrelated refactors.
- [x] **Step 4: Verify** all applicable tests and generated runtime drift.
- [x] **Step 5: Commit** as `feat: apply safe configuration precedence`.

Task 3 also migrates `init` from the legacy `.aunoforge/config.yml` shape to the versioned `.aunoforge/config.json` contract so newly initialized projects are immediately valid and contain no inherited write/merge/publish authorization fields.

---

### Task 4: Maintained documentation and Phase 6 full gate

**Files:**
- Create: `docs/commands/config.md`
- Modify: docs-as-code tests under `test/`.
- Modify generated `dist/action/*.mjs` only if proven by `pnpm build:action` drift.

**Interfaces:**
- Documents config path, schema version, seven presets, inheritance boundary, precedence, and the explicit write-permission exclusion.

- [x] **Step 1: Write docs-as-code RED tests**.
- [x] **Step 2: Prove RED**.
- [x] **Step 3: Add maintained examples** for `recommended`, `security`, `wordpress`, and `config validate`.
- [ ] **Step 4: Run full verification**: lint, typecheck, tests, build, build:action drift, recipes, Node 20/22/24, macOS, Windows, AunoForge Review.
- [ ] **Step 5: Update the primary PR with exact RED/GREEN and exact-head CI evidence, then leave it for human merge only.**
