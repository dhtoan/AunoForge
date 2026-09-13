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

## Incremental evidence review

Use `--baseline` with an explicit local file containing a prior AunoForge JSON review. The comparison is fully offline: AunoForge reads the supplied file, compares stable finding fingerprints, and does not remotely store a baseline or auto-discover a baseline from GitHub, Actions artifacts, or another service.

```bash
node packages/cli/dist/bin.js review \
  --root /path/to/repo \
  --provider mock \
  --diff ./change.diff \
  --baseline ./previous-aunoforge-review.json \
  --format json
```

Incremental results use four states:

- `new`: the fingerprint is present now but was absent from both the previous current findings and resolved history.
- `persistent`: the same fingerprint is still present without a severity increase.
- `resolved`: a fingerprint present in the baseline current findings is no longer present now.
- `regressed`: either the same fingerprint has a severity increase, or a previously resolved fingerprint returns.

The current raw review remains complete inside the incremental JSON envelope. Only the comparison layer changes how findings are classified. A workflow may download a previous `aunoforge-report` artifact and then pass its JSON file as `baseline`, but artifact download/orchestration stays outside AunoForge core. This keeps storage policy explicit and avoids giving AunoForge new repository permissions.

## Initialize configuration

```bash
npx aunoforge init --dry-run
npx aunoforge init
```

Initialization never overwrites an existing `.aunoforge/config.json`.

## GitHub Actions result surfaces

AunoForge writes a GitHub Step Summary automatically when it runs as a GitHub Action. The summary includes the recommendation, provider, verified/unverified finding counts, severity counts, annotation emitted/overflow counts, report format, and report file name. With a baseline, it also leads with new, regressed, persistent, and resolved counts. Step Summary needs no additional repository write permission.

For pull requests, AunoForge can emit GitHub workflow annotations for evidence-verified findings that intersect changed lines. Workflow annotations are runner commands, not Checks API writes, so they do not require `checks: write`. By default AunoForge annotates only medium-or-higher findings and emits at most 25 annotations per Action run; additional eligible findings remain in the full report and are counted as overflow in Step Summary. When an incremental baseline is supplied, annotations are limited to `new` and `regressed` findings; without a baseline, the existing Phase 2 annotation behavior is unchanged.

Use `--format sarif` in the CLI or `format: sarif` in the Action to produce a SARIF 2.1.0 report. SARIF is a portable report surface only: AunoForge does not automatically upload SARIF to GitHub code scanning, and enabling SARIF does not grant additional repository permissions.

### Opt-in sticky PR comments

Sticky PR comments are disabled by default. The normal AunoForge Action path stays read-only and never needs `pull-requests: write`. Enable comments only in a workflow where you deliberately want AunoForge to write one review summary back to the pull request.

Grant the job the minimum write permission and enable both explicit runtime gates on the AunoForge step:

```yaml
permissions:
  contents: read
  pull-requests: write

# on the AunoForge Action step
with:
  comment: 'true'
  allow-write: 'true'
```

Both `comment: 'true'` and `allow-write: 'true'` are required. Comment mode also requires `GITHUB_TOKEN`; a missing token or insufficient GitHub comment permission fails clearly instead of silently falling back to another write path.

AunoForge owns its sticky review comment with the hidden marker `<!-- aunoforge:review-comment -->`. On the first run it creates one marked comment. On later runs it updates that marked comment in place instead of posting a new comment. Unmarked human comments are never selected for update.

Fork pull requests keep the read-only default when comment mode is disabled. Do not grant write permissions to untrusted fork workflows merely to enable comments; keep review and annotations read-only unless a maintainer has deliberately chosen the write-capable workflow context.

The full report remains available through the Action's `report-path` output. Artifact upload is optional and stays at the workflow layer with GitHub's maintained `actions/upload-artifact@v4`; it does not require enabling AunoForge PR comments. See the explicitly labeled current-main / v0.2 example at [`examples/aunoforge-review-v0.2.yml`](examples/aunoforge-review-v0.2.yml).

## Next

Learn about [recipes](concepts/recipes.md), [providers](concepts/providers.md), and the [security model](concepts/security.md), or jump to the [review command](commands/review.md).
