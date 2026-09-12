# Contributing to AunoForge

Thanks for helping make open-source maintenance more reproducible and safer.

## Good first contributions

A recipe, fixture, docs correction, platform compatibility fix, or focused test is preferred over a large new subsystem. The v0.1.0 scope intentionally excludes a SaaS dashboard, GitHub App, MCP server, autonomous merge flow, and package publishing automation.

## Development

Requirements: Node.js 20+ and pnpm 10.15.1.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

New behavior follows test-first development: add the smallest failing test, verify the expected failure, add the minimal implementation, then run the focused and full suites.

## Recipes

Read [docs/contributing/recipes.md](docs/contributing/recipes.md). Recipes must stay declarative. A contribution that introduces arbitrary `run`, shell execution, or recipe network access will be rejected for v0.1.0.

## Pull requests

Keep changes focused, explain the maintenance problem, include tests for behavior changes, and call out security or contract implications. Do not include credentials, proprietary source code, or generated adoption claims.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and license your contribution under the repository's [Apache-2.0 license](LICENSE).
