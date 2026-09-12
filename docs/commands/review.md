# `review`

Runs exactly six model review passes — correctness, regression, security, compatibility, test coverage, and breaking changes — plus deterministic checks. Findings are deduplicated and evidence-aware.

Local diff:

```bash
npx aunoforge review --root . --provider mock --format markdown
```

GitHub pull request:

```bash
npx aunoforge review --pr 42 --owner OWNER --repo REPO --provider codex --model MODEL --format json
```

`--run-tests` never gives the model shell authority; fork PRs are explicitly prevented from secret-bearing command execution.

A saved unified diff can be reviewed without reading local Git state:

```bash
npx aunoforge review --diff path/to/change.diff --provider mock --format json
```
