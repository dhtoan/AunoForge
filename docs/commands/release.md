# `release`

`aunoforge release` prepares deterministic, read-only release intelligence from repository evidence. It can summarize conventional Git commits and, when GitHub metadata is explicitly supplied, merged pull requests and contributor usernames.

## Quick start

```bash
npx aunoforge release --root . --from v0.1.0
npx aunoforge release --root . --from v0.1.0 --format terminal
npx aunoforge release --root . --from v0.1.0 --format json --dry-run
```

Optional GitHub enrichment remains read-only:

```bash
npx aunoforge release \
  --root . \
  --from v0.1.0 \
  --owner OWNER \
  --repo REPO \
  --since 2026-09-01T00:00:00Z \
  --format json \
  --dry-run
```

Supported output formats are `markdown`, `terminal`, and `json`. Markdown remains the default for compatibility. JSON emits the normalized evidence dataset without publication state.

`--dry-run` makes the read-only intent explicit. The release command does not create tags, change repository files, push branches, create or publish a GitHub release, or publish or modify any package.

## Categories

Release evidence is normalized into five categories:

- **Breaking** — explicit breaking evidence.
- **Features** — release-worthy features.
- **Fixes** — bug fixes.
- **Security** — security changes.
- **Maintenance** — other release-worthy maintenance changes when stronger evidence is absent.

For merged pull requests, recognized labels take precedence over title patterns. If no recognized evidence is available, the deterministic fallback is Maintenance. Each normalized change retains evidence such as a commit hash, PR label, title pattern, or fallback marker.

## Semantic-version guidance

AunoForge recommends the highest evidence-backed semantic-version bump:

- Breaking → **major**
- Features → **minor**
- Fixes, Security, or Maintenance → **patch**
- no release-worthy evidence → `none`

This is guidance only. AunoForge does not publish a GitHub release and does not publish or modify a package. A human remains responsible for deciding whether and how to release.

## Contributors

When GitHub enrichment provides an explicit merged-PR author, the normalized dataset can include that username in `contributors`. AunoForge does not claim that someone is a first-time contributor unless repository-history evidence proves that status.
