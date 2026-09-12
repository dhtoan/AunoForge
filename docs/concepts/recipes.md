# Recipes

Recipes describe maintenance intent without executable arbitrary code. v0.1.0 uses schema `aunoforge.dev/recipe/v1` and the JSON-compatible subset of YAML.

A recipe declares project applicability, passes, checks, requested capabilities, permissions, provider capabilities, and output contract. Safe mode denies `shell.execute` and `network.fetch`; builtin recipes shipped in this repository request neither.

List and validate recipes:

```bash
npx aunoforge recipes list
npx aunoforge recipe validate recipes/wordpress/plugin-review.yml
npx aunoforge recipe test recipes/wordpress/plugin-review.yml
```

For contributions see [Contributing recipes](../contributing/recipes.md).
