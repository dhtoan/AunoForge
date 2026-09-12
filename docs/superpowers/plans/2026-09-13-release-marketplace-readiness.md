# AunoForge v0.2 Release and Marketplace Readiness Plan

Date: 2026-09-13
Status: Active implementation plan

## Goal

Prepare the already merged v0.2 user-visible work for a trustworthy release and optional GitHub Marketplace publication without publishing a release, claiming Marketplace availability, or adding repository write automation.

## Approved scope

This plan implements Milestone 5 from `docs/superpowers/specs/2026-09-12-v0.2-star-worthy-growth-design.md` and the release/Marketplace readiness step in `docs/superpowers/specs/2026-09-13-github-native-evidence-review-platform-design.md`.

The smallest coherent slice is:

- complete supported `action.yml` Marketplace branding metadata;
- add one deterministic `pnpm release:check` command;
- validate the checked-in generated Action runtime is clean after regeneration;
- validate stable and next release tag syntax plus current stable documentation references;
- require a non-placeholder v0.2 release-notes draft derived from already merged work;
- document the final Marketplace publication as a manual GitHub UI step;
- keep release creation, Marketplace publication, package publication, and auto-merge outside this PR.

## Safety constraints

- No release is created by this PR.
- No tag is moved or created by this PR.
- No Marketplace publication is claimed or automated.
- No new token, credential, or GitHub write permission is introduced.
- No generated Action runtime source behavior changes are required.
- Existing read-only defaults remain unchanged.
- Human merge remains mandatory.

## TDD sequence

1. Add `test/release-readiness.test.mjs` first.
2. Prove RED because Marketplace branding, the release checker, release guide, and v0.2 notes draft are absent.
3. Add the minimum GREEN implementation.
4. Run the focused release-readiness test.
5. Run lint, typecheck, full tests, build, generated-runtime drift verification, builtin recipe validation, macOS smoke, and Windows smoke through normal CI.
6. Require PR-triggered AunoForge Review and GitHub CI to pass before calling the milestone complete.

## Deterministic release check contract

`pnpm release:check` regenerates the checked-in Action runtime and then validates repository release evidence.

The validator receives explicit `--stable-tag` and `--next-tag` values. It must:

- reject non-semver release tags;
- require `action.yml` to retain the Node 24 packaged runtime;
- require supported Marketplace branding (`shield` / `blue`);
- require `dist/action/index.mjs` and `dist/action/cli.mjs`;
- fail when regenerated `dist/action` differs from the checked-in tree;
- require README and the maintained stable example to reference the explicit current stable tag;
- require `docs/releases/<next-tag-without-v>.md` to exist and contain real release notes with no TBD/TODO/placeholder markers;
- require the release guide to state that Marketplace publication is manual and must not be claimed before the GitHub UI confirms it.

The validator does not call the GitHub API and does not publish anything.

## v0.2 release-note evidence

The initial v0.2 draft may describe only merged functionality already present on `main`, including:

- packaged Node 24 GitHub Action runtime;
- GitHub Step Summary and optional artifact path;
- Markdown/JSON/SARIF reporting and bounded diff-scoped workflow annotations;
- incremental baseline comparison with new/persistent/resolved/regressed states;
- verified stable-install proof and current-main v0.2 example separation.

Sticky-comment work must not be claimed unless it has actually merged before the final release notes are published.

## Acceptance criteria

- The RED test is observed failing before implementation.
- `action.yml` contains valid supported branding metadata.
- `pnpm release:check` is deterministic and read-only apart from rebuilding generated runtime in the worktree.
- v0.2 draft release notes contain only merged functionality.
- the release guide documents the manual Marketplace UI/developer-agreement gate without claiming publication occurred;
- no runtime permission boundary changes;
- exact-head CI and AunoForge Review pass;
- no auto-merge.
