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

## Next

Learn about [recipes](concepts/recipes.md), [providers](concepts/providers.md), and the [security model](concepts/security.md), or jump to the [review command](commands/review.md).
