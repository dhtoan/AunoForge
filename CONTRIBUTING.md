# Contributing to AunoForge

Thanks for helping make open-source maintenance more reproducible and safer.

## Good first contributions

A recipe, fixture, docs correction, platform compatibility fix, or focused test is preferred over a large new subsystem. The v0.1.0 scope intentionally excludes a SaaS dashboard, GitHub App, MCP server, autonomous merge flow, and package publishing automation.

## Development

Requirements: Node.js 20+ and pnpm 10.15.1.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

New behavior follows test-first development: add the smallest failing test, verify the expected failure, add the minimal implementation, then run the focused and full suites.

## GitHub Action runtime

The local CLI supports Node.js 20+ and is tested on Node 20, 22, and 24. The packaged GitHub JavaScript Action declares the current GitHub-hosted Node 24 runtime independently; changing the Action host runtime does not raise the CLI's Node.js version floor.

`dist/action/` is generated release/runtime code and is intentionally committed so repositories using the Action do not install AunoForge dependencies or compile TypeScript during a workflow run.

When changing `scripts/action.mjs`, CLI code used by `review`, provider adapters, reporters, or their dependencies, regenerate the runtime:

```bash
pnpm build:action
```

Before opening a PR, confirm regeneration is clean:

```bash
pnpm build:action
git diff --exit-code -- dist/action
```

CI performs the same drift check. Do not hand-edit `dist/action/index.mjs` or `dist/action/cli.mjs`.

## Recipes

Read [docs/contributing/recipes.md](docs/contributing/recipes.md). Recipes must stay declarative. A contribution that introduces arbitrary `run`, shell execution, or recipe network access will be rejected for v0.1.0.

## Pull requests

Keep changes focused, explain the maintenance problem, include tests for behavior changes, and call out security or contract implications. Do not include credentials, proprietary source code, or generated adoption claims.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and license your contribution under the repository's [Apache-2.0 license](LICENSE).
