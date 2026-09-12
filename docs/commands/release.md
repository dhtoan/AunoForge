# `release`

Drafts factual release notes from conventional Git commit prefixes. Optional GitHub enrichment can add merged PR numbers and contributors.

```bash
npx aunoforge release --root . --from v0.1.0
npx aunoforge release --root . --from v0.1.0 --owner OWNER --repo REPO --since 2026-09-01T00:00:00Z
```

The command does not publish a GitHub release or npm package.
