# AunoForge GitHub-Native Evidence Review Platform Design

Date: 2026-09-13
Status: Approved direction; implementation requires per-milestone plan and controlled PR execution

## Context

This design extends, rather than replaces, the existing AunoForge v0.2 controlled PR train in `docs/superpowers/specs/2026-09-12-v0.2-star-worthy-growth-design.md`.

AunoForge already differentiates itself through evidence-aware findings, deterministic checks, provider-neutral adapters, human-controlled writes, safe defaults, issue triage, reproduction planning, release preparation, recipes, and a GitHub Action. The next product step is to make those capabilities feel native inside GitHub while preserving the project's trust model.

The design was informed by patterns proven in mature open-source projects with at least 1,000 GitHub stars, including:

- The-PR-Agent/pr-agent: command-oriented PR workflows, provider flexibility, local CLI plus GitHub integration, and large-PR handling.
- reviewdog/reviewdog: diff-scoped diagnostics, multiple reporters, GitHub Checks/annotations, SARIF, and local filtering.
- super-linter/super-linter: broad analyzer orchestration, parallel execution, curated tool composition, status reporting, and extensive per-analyzer testing.
- renovatebot/renovate: auto-discovery, strong configuration, confidence metadata, presets, and cross-platform automation.
- google/osv-scanner: source/lockfile discovery, offline-aware security analysis, low-noise vulnerability results, and guided remediation metadata.
- release-drafter/release-drafter: deterministic release categorization, semantic-version guidance, dry-run operation, and contributor attribution.
- step-security/harden-runner: least-privilege CI design, job summaries, baselines, anomaly detection, and current GitHub Action runtime maintenance.

AunoForge should learn from these product patterns without copying implementation, branding, or proprietary behavior. Its differentiator remains:

> AI proposes. AunoForge verifies. Maintainers decide.

## Product goal

Turn AunoForge into a GitHub-native evidence review platform that gives maintainers a trustworthy answer to four questions after every meaningful code change:

1. What changed?
2. What evidence-backed risk or maintenance issue is new?
3. What was already known versus newly introduced or resolved?
4. What should a human maintainer inspect next?

The platform must remain useful with no API key through deterministic/mock operation, and every repository mutation must remain explicit and opt-in.

## Non-goals

This design does not authorize:

- autonomous merge, release, package publish, branch push, dependency update, or repository mutation;
- a hosted dashboard, IDE extension, MCP server, or GitHub App;
- synthetic comments or generated activity for visibility;
- replacing dedicated scanners such as OSV-Scanner, Trivy, reviewdog, or Super-Linter;
- adding broad integrations before a concrete AunoForge use case exists;
- sending source code to external providers when the selected workflow can be completed deterministically.

## Global constraints

These constraints apply to every milestone in this design:

- Maintain exactly one maintainer-generated primary upgrade PR at a time.
- No auto-merge.
- Read-only behavior remains the default.
- Any GitHub write requires explicit configuration and the minimum required permission.
- Fork-originated pull requests must never gain an implicit write path.
- Provider credentials are optional unless the user explicitly selects a network provider.
- Deterministic/mock mode must remain a first-class zero-key path.
- Findings must keep provenance: `deterministic`, `model`, or `hybrid`.
- Evidence validation remains mandatory before a model-derived file/line claim is treated as verified.
- Behavior-changing work uses test-first development where practical.
- Relevant lint, typecheck, tests, build, generated-runtime drift checks, platform smoke, and GitHub CI must pass before a milestone is called complete.
- Generated reports must be reproducible from the same repository state, configuration, and deterministic inputs, excluding inherently external provider variance.

## Delivery sequence

The existing v0.2 sequence remains the backbone. This design adds a longer product sequence around it:

0. GitHub Action runtime maintenance: Node 24.
1. GitHub-native Step Summary and opt-in report artifact.
2. Structured reporters: Markdown, JSON, SARIF, and GitHub annotations/check surface.
3. Incremental evidence review with stable finding fingerprints and new/persistent/resolved/regressed states.
4. Security intelligence for dependency and manifest risk.
5. Release intelligence with deterministic categorization and semantic-version guidance.
6. Configuration presets and validation.

Sticky opt-in PR comments, the 60-second proof, stable release-tag documentation, and Marketplace/release readiness from the existing v0.2 spec remain required and must be interleaved without violating the one-primary-PR rule.

## Phase 0 — GitHub Action runtime maintenance

### Problem

Milestone 1 packages AunoForge as a checked-in JavaScript Action runtime. Keeping that runtime current is part of the Action's security and maintenance posture.

A mature GitHub Action such as StepSecurity Harden-Runner currently declares `runs.using: node24`, demonstrating that Node 24 is supported for JavaScript Actions and is an appropriate current runtime target.

### Design

Before Milestone 1 is merged, update the public Action runtime contract from Node 20 to Node 24 if the change remains compatible with AunoForge's generated bundle and CI environment.

This does not require dropping Node 20 support for the local CLI. The public CLI version floor and the GitHub-hosted Action runtime are separate compatibility decisions.

### Acceptance criteria

- `action.yml` declares `runs.using: node24`.
- Manifest tests fail before the change and pass after it.
- The checked-in generated Action runtime is regenerated from maintained source and passes drift checks.
- The packaged Action runs successfully in the repository's GitHub Action smoke workflow.
- Existing CLI quality jobs continue to cover the supported Node versions defined by AunoForge policy.
- No additional repository permission is introduced.

## Phase 1 — GitHub-native report surface

### Problem

A report file alone is easy to miss. Maintainers should understand the result from the GitHub Actions run without hunting through logs or wiring custom post-processing.

### Components

#### Step Summary

The Action writes a concise Markdown section to `GITHUB_STEP_SUMMARY` containing:

- AunoForge run mode and provider.
- Overall status.
- Verified/unverified finding counts.
- Severity counts.
- Report format and path.
- A short note that repository writes are disabled unless explicitly enabled.

Summary generation is local file output and must not require additional GitHub token permissions.

#### Opt-in artifact

The Action exposes enough metadata for the maintained workflow example to upload a report with `actions/upload-artifact` only when explicitly enabled.

Artifact upload is deliberately kept outside AunoForge's core Action runtime so AunoForge does not need to reimplement GitHub's artifact protocol or gain extra token capabilities.

A stable default artifact name should be documented, for example `aunoforge-report`, while allowing workflow authors to choose another name at the workflow layer.

### Acceptance criteria

- Default Action run emits a readable Step Summary.
- Summary generation works with mock mode and no network credentials.
- Artifact upload can be enabled without enabling comments or any repository mutation.
- JSON reports remain machine-consumable and unchanged in meaning.
- No new GitHub write permission is required for the AunoForge Action itself.

## Phase 2 — Structured reporter architecture

### Problem

AunoForge currently produces Markdown/JSON reports, but GitHub-native adoption benefits from standard diagnostic formats and scoped annotations.

### Reporter contract

Introduce an internal reporter contract that consumes the normalized AunoForge review result and emits one representation without changing review semantics.

Initial reporters:

- `markdown`
- `json`
- `sarif`
- `github`

The reporter layer must not re-run providers, reinterpret evidence, or invent findings. It only renders already-normalized results.

### SARIF

SARIF output maps verified findings to SARIF results using stable rule/category identifiers, severity mapping, file locations, and evidence-derived messages.

Unverified model claims must not be silently promoted to verified SARIF locations. They may be omitted from location-based SARIF results or represented without a trusted location only if the SARIF contract remains valid and unambiguous.

### GitHub annotations/check surface

The GitHub reporter focuses on changed lines and actionable findings. A finding is eligible for an inline annotation when:

- its file path and line range were evidence-verified;
- the location intersects the reviewed diff or configured changed-file scope;
- its severity meets the configured annotation threshold.

Annotations must be bounded to avoid flooding a PR. A default maximum is required, with overflow summarized in the report rather than emitted as unlimited annotations.

The first implementation should prefer GitHub workflow annotations and Step Summary because they work with minimal permissions. A richer Checks API integration should only be added if it provides clear value that annotations cannot provide and its permission model is explicit.

### Acceptance criteria

- Reporter outputs are generated from one normalized review result.
- SARIF validates against the expected SARIF shape and contains stable rule identifiers.
- Verified diff findings can produce GitHub annotations.
- Findings outside the changed scope are not emitted as inline annotations by default.
- Annotation count is capped and overflow is summarized.
- No PR comment is created by reporter selection alone.

## Phase 3 — Incremental evidence review

### Problem

Repeating the same finding on every commit creates noise and makes it hard for a maintainer to see whether a new change improved or worsened the PR.

### Finding fingerprint

Each normalized finding receives a deterministic fingerprint derived only from stable semantic fields. The fingerprint must not depend on volatile prose ordering or provider-specific IDs.

Recommended fingerprint inputs:

- normalized repository-relative file path;
- category/rule identifier;
- normalized evidence anchor or line neighborhood;
- normalized severity only when severity materially defines finding identity.

Explanation prose should not be part of the primary fingerprint because providers may rephrase the same issue.

### Comparison states

Given a prior baseline report and a current report, findings are classified as:

- `new`: present now, absent from the baseline;
- `persistent`: same fingerprint remains;
- `resolved`: present in the baseline, absent now;
- `regressed`: a previously resolved fingerprint returns, or an existing fingerprint increases in verified severity according to explicit rules.

The raw current report remains complete. Incremental state is an additional comparison layer, not a destructive filter.

### Baseline source

Initial implementation uses an explicit prior AunoForge JSON report as the comparison input. This keeps comparison deterministic and testable without requiring a hosted state store.

GitHub workflow examples may later download the previous artifact or retain a sticky comment reference, but storage orchestration remains outside the core comparison engine.

### Noise controls

- Step Summary leads with `new` and `regressed` findings.
- Persistent findings remain available but visually secondary.
- Resolved findings are summarized positively without claiming code correctness beyond the specific finding fingerprint.
- Sticky PR comments, when implemented under the existing v0.2 milestone, update a single AunoForge-owned comment instead of posting a new comment per run.

### Acceptance criteria

- Fingerprints are stable across equivalent runs.
- Rephrased explanation text does not create a new fingerprint when evidence identity is unchanged.
- New, persistent, resolved, and regressed states are covered by deterministic fixtures.
- Comparison works fully offline with two JSON reports.
- No state is stored remotely by AunoForge core.

## Phase 4 — Security intelligence

### Problem

Maintainers often need to know whether a change introduces dependency or package risk, but AunoForge should not become a duplicate vulnerability database or an autonomous remediation bot.

### Command

Add a read-only command:

```text
aunoforge security
```

The command has two layers.

#### Deterministic local inventory

Without network access, AunoForge discovers supported package manifests and lockfiles, records ecosystem/package/version evidence, and reports malformed or ambiguous dependency metadata.

The initial supported ecosystem should be intentionally narrow and selected from formats already easy to parse reliably in the TypeScript codebase. Expansion requires fixtures for each format.

#### Optional advisory enrichment

When explicitly enabled, an advisory provider can enrich the local inventory with vulnerability information from a documented source such as OSV.

Network advisory lookups must be a separate adapter so deterministic inventory remains usable offline and tests do not depend on live services.

Normalized security findings should include:

- package name;
- ecosystem;
- installed/resolved version when available;
- direct or transitive classification when the source format proves it;
- advisory identifier and severity when enrichment is enabled;
- known fixed version when the advisory source provides one;
- manifest/lockfile evidence location;
- source/provenance and confidence.

### Remediation boundary

AunoForge may suggest a version or remediation direction but must not modify manifests or lockfiles in this phase.

### Acceptance criteria

- Local dependency inventory works without network access or provider keys.
- Unsupported or ambiguous files fail clearly rather than producing guessed package identities.
- Advisory enrichment is opt-in and isolated behind an adapter.
- Tests use fixtures, not live advisory requests.
- No package manager command or dependency update is executed automatically.

## Phase 5 — Release intelligence

### Problem

AunoForge can prepare release notes, but maintainers benefit from deterministic grouping, version guidance, and contributor attribution that can be reviewed before publishing.

### Design

Extend `aunoforge release` with deterministic rules for:

- categories: `Features`, `Fixes`, `Security`, `Breaking`, `Maintenance`;
- semantic-version recommendation: `patch`, `minor`, or `major`;
- contributor attribution derived from repository/PR history;
- first-time contributor identification only when repository evidence proves it;
- Markdown and JSON output;
- `--dry-run` as the safe documented path.

Rules should prefer explicit repository evidence in this order:

1. configured labels/rules;
2. conventional commit or configured title patterns;
3. deterministic fallback category.

A model may optionally draft prose from the deterministic release dataset, but it must not decide the source facts used for versioning or contributor identity.

### Acceptance criteria

- The same repository history and config produce the same category/version recommendation.
- Breaking changes deterministically force a major recommendation when semantic versioning is enabled.
- Features can produce a minor recommendation; fixes/maintenance can produce patch according to documented rules.
- `--dry-run` performs no release publication.
- JSON output exposes the evidence used for categorization and version recommendation.

## Phase 6 — Configuration presets

### Problem

As AunoForge gains reporters, thresholds, security discovery, and release rules, a flat collection of CLI flags becomes difficult to reuse across repositories.

### Configuration file

Introduce a versioned project configuration under an AunoForge-owned path, with the exact filename selected during implementation after checking existing config conventions. The schema must have an explicit version and reject unknown security-sensitive keys rather than silently ignoring them.

### Presets

Initial built-in presets:

- `recommended`
- `minimal`
- `strict`
- `security`
- `node`
- `python`
- `wordpress`

Presets are configuration bundles, not executable plugins. They may set reporter defaults, thresholds, deterministic checks, file discovery rules, or release categorization, but may not grant GitHub write permissions or provider credentials.

### Inheritance

Support a bounded `extends` mechanism for built-in presets first. Remote preset fetching is out of scope because it introduces trust, caching, and supply-chain concerns.

### Validation

Add:

```text
aunoforge config validate
```

Validation reports schema errors, unknown fields, conflicting settings, and any setting that would require a GitHub write path.

### Acceptance criteria

- Configuration is versioned and schema-validated.
- Built-in presets resolve deterministically.
- `extends` cannot elevate write permission or inject credentials.
- Invalid/unknown security-sensitive keys fail closed.
- CLI flags can override non-security-sensitive configuration according to documented precedence.

## Architecture boundaries

To keep implementation testable and maintainable, the following boundaries should remain explicit:

### Review engine

Responsible for deterministic/model review and evidence validation. It produces normalized findings and does not know about GitHub presentation details.

### Reporter layer

Consumes normalized results and emits Markdown, JSON, SARIF, Step Summary fragments, or GitHub annotation payloads. It cannot create findings.

### Comparison layer

Consumes normalized report snapshots and computes fingerprint-based incremental state. It has no network dependency.

### Security inventory/advisory layers

Inventory parses local evidence. Advisory adapters enrich inventory only when explicitly enabled. The advisory adapter cannot mutate package files.

### Release intelligence layer

Consumes repository/PR history and configuration to produce categorized release data and version guidance. Publication remains outside this layer.

### Configuration layer

Loads, validates, resolves presets, and exposes a normalized immutable configuration to commands. It cannot infer or grant permissions.

## Data model evolution

Normalized findings should evolve compatibly so reporters and incremental comparison share one canonical representation.

Any schema change must:

- carry an explicit schema/report version;
- preserve source/provenance;
- distinguish verified from unverified location claims;
- keep stable category/rule identifiers separate from human-readable messages;
- support deterministic serialization for fingerprint tests;
- document migration behavior for prior JSON reports used as baselines.

## Error handling

- Missing optional environment variables should only fail the feature that requires them.
- Invalid GitHub write configuration fails before attempting a write.
- Invalid baseline reports fail with a schema/version error rather than silently falling back to a full review comparison.
- Invalid SARIF/report targets fail the selected reporter without changing review findings.
- Network advisory failures are reported as enrichment failures; deterministic local security inventory remains available when possible.
- Unsupported package formats are reported as unsupported, not guessed.
- Annotation overflow is summarized rather than silently dropped.

## Testing strategy

Every behavior-changing phase follows RED -> GREEN -> verification.

Required test classes across the program:

- manifest/runtime contract tests for Node 24 Action packaging;
- Step Summary golden fixtures;
- reporter golden fixtures for Markdown, JSON, and SARIF;
- GitHub annotation scope/limit tests;
- fingerprint stability fixtures;
- incremental state transition tests;
- security manifest/lockfile fixtures with no live network dependency;
- advisory adapter contract fixtures;
- release categorization and semver fixtures;
- preset resolution/config validation tests;
- explicit permission-boundary and fork-safety regression tests;
- generated Action runtime drift checks after Action-source changes;
- platform smoke where the touched functionality is platform-dependent.

## Controlled PR mapping

The one-primary-PR rule remains mandatory. The proposed order after the current PR is resolved is:

1. Amend/finish current Action packaging PR with Node 24 runtime if still unmerged and verified.
2. Step Summary + opt-in artifact workflow integration.
3. Reporter contract + SARIF + bounded GitHub annotations.
4. Sticky AunoForge-owned PR comment from the existing v0.2 plan, integrated with reporter output.
5. Incremental evidence fingerprint/comparison engine.
6. 60-second README proof + stable release-tag usage from the existing v0.2 plan.
7. Release/Marketplace readiness from the existing v0.2 plan.
8. Security intelligence: local inventory first, advisory enrichment second only if the first is stable.
9. Release intelligence categorization/version guidance.
10. Configuration schema + built-in presets.

A later PR may be split if its RED tests reveal that the scope is not reviewable as one coherent change. No milestone should be split merely to create more activity.

## Success criteria

This program is successful when maintainers can:

- add AunoForge to GitHub Actions without a source build in the consumer repository;
- understand a run from the Step Summary;
- consume reports as Markdown, JSON, or SARIF;
- see a bounded set of verified findings on changed code;
- distinguish new, persistent, resolved, and regressed evidence across runs;
- inspect dependency/security evidence without granting mutation rights;
- prepare deterministic release categories and version guidance before publication;
- reuse safe configuration presets without allowing a preset to elevate permissions.

Product success should be observed through legitimate signals such as real external contributors, repeat Action usage, real issues/discussions, independently verifiable mentions, and organic stars/forks/watchers. These are outcomes of useful software, not activity targets.

## Explicitly deferred

The following remain deferred until real usage justifies their maintenance and security cost:

- hosted state service for cross-run baselines;
- remote configuration presets;
- autonomous remediation commits;
- GitHub App installation model;
- web dashboard;
- IDE integration;
- MCP server;
- organization-wide policy control plane;
- automatic release publishing;
- automatic merge.
