# Security command

`aunoforge security` inventories supported Node dependency evidence without modifying the repository.

## Offline by default

The command is offline by default. It recursively discovers `package.json`, `package-lock.json`, and `pnpm-lock.yaml`, preserves the evidence each source proves, and performs no advisory request unless you explicitly opt in.

```bash
npx aunoforge security --format json
```

Declared ranges from `package.json` remain declaration evidence. Resolved versions are emitted only when a supported lockfile proves them.

## Optional OSV enrichment

Advisory enrichment is explicit:

```bash
npx aunoforge security --format json --advisory osv
```

`--advisory osv` sends only proven resolved package versions to the OSV-compatible adapter. It does not run a package manager, update manifests or lockfiles, create commits, or write to GitHub.

## GitHub Action

The current v0.2 Action can expose the same offline inventory without provider credentials or a GitHub write token:

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: dhtoan/AunoForge@main
    with:
      command: security
      format: json
```

Set `advisory: osv` only when network-backed advisory enrichment is desired. The Action keeps `comment` and `allow-write` disabled for `command: security`.

See [`../examples/aunoforge-security.yml`](../examples/aunoforge-security.yml) for the maintained read-only workflow.
