# `triage`

Reads a GitHub issue and produces a structured classification, severity, suggested labels, missing information, duplicate candidates, and next action. It does not apply labels.

```bash
npx aunoforge triage 123 --owner OWNER --repo REPO --provider codex --model MODEL --format json
```

Use `--provider mock` for an offline/no-model-development path.

For offline examples and CI fixtures, `--fixture path/to/github-issue.json` replaces the GitHub read with a local normalized issue fixture. It never enables writes.
