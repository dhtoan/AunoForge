# Contributing Recipes

A recipe contribution should solve one concrete maintainer workflow and include evidence that validation behaves safely.

1. Add a JSON-compatible YAML file under the appropriate `recipes/<ecosystem>/` directory.
2. Use schema `aunoforge.dev/recipe/v1` and a unique ID.
3. Keep `permissions.shell` and `permissions.network` set to `deny` for v0.1.0.
4. Request only capabilities needed by the workflow.
5. Validate it:

```bash
npx aunoforge recipe validate recipes/your-ecosystem/your-recipe.yml
npx aunoforge recipe test recipes/your-ecosystem/your-recipe.yml
```

6. Add or extend fixtures when the recipe introduces a deterministic protected condition.
7. Open a focused PR describing the maintenance problem and expected output contract.

Recipes containing arbitrary `run` fields are rejected by the strict schema.
