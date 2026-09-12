# Getting Started

## Requirements

Use Node.js 20 or newer. For source development, use pnpm 10.15.1.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install
pnpm build
```

## Inspect a repository without AI network access

```bash
node packages/cli/dist/bin.js doctor --root /path/to/repo
node packages/cli/dist/bin.js review --root /path/to/repo --provider mock --format markdown
```

After npm publication the same flow is available through `npx aunoforge`.

## Initialize configuration

```bash
npx aunoforge init --dry-run
npx aunoforge init
```

Initialization never overwrites an existing `.aunoforge/config.yml`.

## GitHub Actions result surfaces

AunoForge writes a GitHub Step Summary automatically when it runs as a GitHub Action. The summary includes the recommendation, provider, verified/unverified finding counts, severity counts, report format, and report file name. Step Summary needs no additional repository write permission.

The full report remains available through the Action's `report-path` output. Artifact upload is optional and stays at the workflow layer with GitHub's maintained `actions/upload-artifact@v4`; it does not require enabling AunoForge PR comments. See [`examples/aunoforge-review.yml`](examples/aunoforge-review.yml).

## Next

Learn about [recipes](concepts/recipes.md), [providers](concepts/providers.md), and the [security model](concepts/security.md), or jump to the [review command](commands/review.md).
