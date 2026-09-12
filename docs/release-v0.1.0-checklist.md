# AunoForge v0.1.0 Release Readiness

Verified on 2026-09-12 before first GitHub publication.

## Local environment

- Node.js: v22.16.0
- TypeScript compiler: 5.8.3
- Package manager declared by the repository: pnpm 10.15.1
- Local sandbox network to `registry.npmjs.org`: unavailable (`EAI_AGAIN`), so a clean `pnpm install` could not be executed locally.
- Local verification used the preinstalled TypeScript/Node toolchain and workspace links. Remote GitHub CI remains the clean-install/platform gate after publication.

## Verified commands

The following completed successfully in the isolated feature worktree:

```text
npm run lint       PASS
npm run typecheck  PASS
npm test           PASS — 75 tests, 75 passed, 0 failed
npm run build      PASS
```

The test suite includes the 10 declared security invariants, provider contracts, golden known-good/known-bad fixtures, CLI workflows, docs links, and evidence normalization.

## CLI smoke verification

All user-facing command surfaces were exercised without repository mutation beyond temporary test repositories:

```text
init --dry-run                                  PASS
doctor                                          PASS
triage --fixture --provider mock                PASS
reproduce --fixture --provider mock             PASS
review --diff --provider mock                   PASS
release --from <tag>                            PASS
recipes list                                    PASS
recipe validate                                 PASS
```

Structured JSON produced by doctor, triage, reproduce, review, recipe validation, and the Action wrapper parsed successfully. The review diff smoke produced the expected deterministic `javascript-eval` finding. Release smoke produced a `Fixed` section from real temporary Git history.

## Action verification

`scripts/action.mjs` ran locally with `provider=mock`, `format=json`, and `comment=false`; the output parsed as a valid review report. PR comment mode was not exercised against live GitHub during local verification and remains opt-in behind `comment=true`, `allow-write=true`, and caller-provided write permission.

## Providers

Source adapters present:

1. Mock — offline deterministic development/testing.
2. Codex/OpenAI — Responses API structured-output adapter.
3. Claude/Anthropic — Messages API structured-output adapter.

No real OpenAI or Anthropic credentials were used during release verification. Live adapters are covered by injected-transport contract/security tests, including malformed output, cancellation, structured parsing, context boundaries, and credential isolation.

## Recipes

Builtin recipe count: **11**.

v0.1.0 recipe files use schema `aunoforge.dev/recipe/v1` and the JSON-compatible subset of YAML. Safe mode rejects arbitrary execution fields, recipe shell execution, and recipe network access.

## Credential check

All tracked text files were scanned with concrete credential-value patterns for OpenAI, Anthropic, GitHub, and private-key headers. Result: **0 tracked credential-pattern values**.

The repository intentionally contains redaction regex definitions and security-test logic; the verification scan checks actual credential-shaped values rather than merely grepping detector names/prefixes.

## Known release limitations

- Clean pnpm installation and Node 20/22/24 platform matrix require remote GitHub CI because this sandbox cannot resolve the npm registry.
- macOS and Windows smoke checks require remote GitHub CI.
- Live GitHub issue/PR network flows were not called from the sandbox; GitHub client behavior is covered by injected-transport tests and offline issue fixtures.
- The first npm package has not been published.
- GitHub release/tag publication is intentionally deferred until the public source branch exists and remote CI succeeds.
- No SaaS dashboard, GitHub App, MCP server, IDE extension, auto-merge, package publishing automation, or destructive repository operations are included in v0.1.0.

## OSS evidence status

No downloads, active repositories, external contributors, merged external PRs, repeat users, or public case studies are claimed yet. See [OSS-EVIDENCE.md](../OSS-EVIDENCE.md).

## Publication gate

Before creating `v0.1.0`:

1. Upload the source branch to the public GitHub repository.
2. Confirm the remote CI clean-install/platform matrix passes.
3. Resolve any remote CI regression.
4. Only then create/push the release tag.
