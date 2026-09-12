# `reproduce`

Converts a GitHub issue into a structured reproduction plan with environment, steps, expected/actual behavior, likely areas, and missing evidence.

```bash
npx aunoforge reproduce 123 --owner OWNER --repo REPO --provider claude --model MODEL --format markdown
```

For offline examples and CI fixtures, `--fixture path/to/github-issue.json` replaces the GitHub read with a local normalized issue fixture.
