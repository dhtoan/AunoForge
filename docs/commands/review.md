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

## Compare against a prior report

`--baseline` accepts an explicit local path to a prior AunoForge JSON report. Baseline comparison works fully offline after the files are present locally; AunoForge does not remotely store the baseline and does not auto-discover a baseline from GitHub or artifact history.

```bash
node packages/cli/dist/bin.js review \
  --root /path/to/repo \
  --provider mock \
  --diff ./change.diff \
  --baseline ./previous-aunoforge-review.json \
  --format json
```

The comparison is fingerprint-based:

- `new` means the current fingerprint was not in the baseline current findings or resolved history.
- `persistent` means the same fingerprint remains without a severity increase.
- `resolved` means a baseline fingerprint disappeared from the current review.
- `regressed` means a matching fingerprint had a severity increase, or a previously resolved fingerprint returns.

A prior incremental JSON report can itself become the next baseline, so resolved fingerprint history carries forward without a remote database. The raw current `ReviewReport` remains complete inside the incremental JSON envelope.

If a workflow wants to reuse a report from a previous run, it may download that artifact before invoking AunoForge. Artifact download and retention orchestration are outside AunoForge core; AunoForge only reads the explicit local baseline path it is given.
