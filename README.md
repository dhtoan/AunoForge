# AunoForge — AI-assisted maintenance you can verify.

AunoForge is an open-source maintainer toolkit for triaging issues, turning bug reports into reproduction plans, reviewing code changes, checking deterministic risk signals, and preparing releases without handing repository control to a model.

**Provider-neutral. Evidence-aware. Human-controlled.**

> AI proposes. AunoForge verifies. Maintainers decide.

## First success

With Node.js 20 or newer:

```bash
npx aunoforge doctor
npx aunoforge review --provider mock --format markdown
```

The `mock` provider makes no external model request. Deterministic checks still run, so it is a useful safe first pass. Until the first npm publication, clone this repository, build it, and run `node packages/cli/dist/bin.js` with the same command arguments.

## What v0.1.0 does

- `init` creates a safe local AunoForge configuration after explicit approval.
- `doctor` scores repository maintenance health deterministically.
- `triage` classifies a GitHub issue without applying labels or changing the issue.
- `reproduce` turns issue text into a structured reproduction plan.
- `review` runs six review passes plus deterministic evidence checks on a local diff or GitHub pull request.
- `release` drafts factual release notes from Git history with optional merged-PR enrichment.
- `recipes list`, `recipe validate`, and `recipe test` expose the extension surface without arbitrary recipe execution.

See [Getting started](docs/getting-started.md) and the [architecture overview](docs/architecture/overview.md).

## Security defaults

AunoForge starts in **safe, read-only mode**. Repository content, issue/PR text, recipes, comments, and model output are treated as untrusted. Recipes cannot execute shell commands or use arbitrary network access in v0.1.0. Model output cannot create an approval token, grant permissions, merge code, publish packages, or mutate a repository.

Read the [security model](docs/concepts/security.md) and [security policy](SECURITY.md).

## Providers

The initial provider adapters are:

- `mock` — deterministic/offline testing, no external model call.
- `codex` — OpenAI Responses API adapter; model is explicitly configured.
- `claude` — Anthropic Messages API adapter; model is explicitly configured.

AunoForge core does not depend on a provider-specific response shape. See [Providers](docs/concepts/providers.md).

## Recipes

Recipes are versioned, declarative, capability-scoped maintenance workflows. v0.1.0 ships 11 builtin recipes for general maintenance, GitHub, WordPress/WooCommerce, Node.js, Python, and Django. Recipe files use the JSON-compatible subset of YAML in v0.1.0 so parsing stays dependency-free and deterministic.

See [Recipes](docs/concepts/recipes.md) and [Contributing a recipe](docs/contributing/recipes.md).

## GitHub Action

The bundled action defaults to read-only review and `comment: false`:

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: read

steps:
  - uses: actions/checkout@v4
  - uses: dhtoan/AunoForge@main
    with:
      provider: mock
      format: markdown
      comment: 'false'
```

PR comments require both `comment: 'true'` and `allow-write: 'true'`, plus `pull-requests: write` in the caller workflow. The default workflow never comments or merges.

## Contributing

The easiest first contribution is a recipe, fixture, or documentation improvement. Read [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and the [recipe contribution guide](docs/contributing/recipes.md).

## Project evidence

AunoForge does not claim downloads, active repositories, contributors, or adoption before those measurements exist. Verifiable launch facts and future evidence fields live in [OSS-EVIDENCE.md](OSS-EVIDENCE.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
