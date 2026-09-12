# Phase 4 Security Intelligence Implementation Plan

Date: 2026-09-13
Status: Active implementation plan for the approved Phase 4 milestone
Spec: `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md`

## Goal

Add read-only security intelligence that starts with deterministic, offline Node dependency inventory and later allows explicitly enabled advisory enrichment without turning AunoForge into a package updater or remote state service.

## Trust and scope boundaries

- `aunoforge security` is read-only.
- Offline inventory works without provider credentials or network access.
- Initial supported evidence sources are `package.json`, `package-lock.json`, and `pnpm-lock.yaml`.
- Relationship classification is emitted only when the source format proves it.
- Advisory lookup is a later, opt-in adapter and tests must not depend on live requests.
- No package-manager command, manifest edit, lockfile edit, release, comment, or other repository write is authorized by this phase.
- Behavior changes use RED -> GREEN test-first development.
- Exactly one primary upgrade PR remains active at a time and human merge is mandatory.

## Delivery slices

### Slice 1 — deterministic `package.json` inventory

Add a pure parser that accepts package.json text and returns normalized npm dependency evidence for direct dependency declarations. Preserve the declared version/range as evidence; do not label it as an installed/resolved version. Reject malformed JSON, invalid top-level shapes, and invalid dependency maps with clear errors. Cover runtime, development, optional, and peer dependency scopes with deterministic ordering and deduplication precedence.

Acceptance:
- works fully offline;
- every emitted package identity is proven by `package.json`;
- every emitted relationship is `direct` because package.json proves only declarations from the project manifest;
- source path and dependency scope are preserved;
- malformed or ambiguous dependency metadata fails clearly rather than being guessed.

### Slice 2 — package-lock inventory

Parse npm lockfile fixtures and emit resolved versions only where the lockfile proves package identity/version. Distinguish direct/transitive only when lockfile metadata plus root package metadata proves the relationship. Reject unsupported lockfile shapes clearly.

### Slice 3 — pnpm-lock inventory

Parse pnpm lockfile fixtures deterministically without running pnpm. Emit resolved package evidence and relationship only when proven by the lockfile/importer structure.

### Slice 4 — CLI security command

Add `aunoforge security` that discovers supported files below the selected root, renders terminal/JSON output, and performs no network request by default. Unsupported manifests are reported explicitly rather than guessed.

### Slice 5 — optional advisory adapter

Introduce an isolated advisory interface and deterministic fixture-backed tests. A documented OSV-compatible adapter may be enabled explicitly; the local inventory remains independently useful offline.

### Slice 6 — GitHub Action/docs integration

Expose security inventory only after CLI behavior is stable. Preserve least privilege, keep provider credentials optional, and add documentation-as-code checks plus maintained examples.

## Verification gate

Before Phase 4 is called complete, require applicable focused tests, full tests, lint, typecheck, build, generated Action runtime drift checks if the Action changes, platform smoke, and GitHub CI/AunoForge Review. Do not auto-merge.
