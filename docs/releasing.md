# Releasing AunoForge

AunoForge release preparation is intentionally separated from publication. The repository may validate a candidate, but a human maintainer makes the final release and Marketplace decisions.

## Deterministic release check

Run:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

The check rebuilds the packaged Action runtime and verifies that the checked-in runtime stays reproducible, Action metadata remains on Node 24 with supported branding, stable documentation points at the published stable tag, and the next release notes contain no placeholders.

The validator performs no GitHub API writes and publishes nothing.

## Release candidate review

Before creating a tag or release, require normal lint, typecheck, tests, build, generated-runtime verification, platform smoke, and GitHub CI. Review the release notes against merged commits and remove any claim for work that has not actually landed.

## GitHub Marketplace publication

Marketplace publication remains a **manual** GitHub UI action. A maintainer must review and accept the **Marketplace Developer Agreement** when GitHub requires it, inspect the release/tag selected by the UI, and explicitly choose **Publish this Action to the GitHub Marketplace**.

Do not claim that AunoForge is published in GitHub Marketplace until GitHub's UI confirms the listing is live. The repository does not automate this step and does not treat a passing release check as Marketplace publication.

## Human-controlled publication

A passing readiness check authorizes no mutation by itself. Tag creation, GitHub Release publication, Marketplace submission, package publication, and merge remain explicit maintainer actions.
