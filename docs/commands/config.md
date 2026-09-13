# `aunoforge config`

AunoForge project configuration lives at `.aunoforge/config.json`. The first supported configuration schema is `schemaVersion: 1`.

```json
{
  "schemaVersion": 1,
  "extends": "recommended"
}
```

Use `aunoforge config validate --root <repository>` to validate the file offline. Validation succeeds only for the versioned, allowlisted schema and returns a non-zero result for invalid JSON, unsupported schema versions, unknown keys, unsupported presets, credential-like settings, or attempts to grant write permission through project configuration.

## Built-in presets

`extends` accepts built-in presets only. AunoForge does not fetch remote presets and does not execute preset code.

The supported built-in preset IDs are:

- `recommended` — safe general-purpose defaults.
- `minimal` — minimal read-only defaults.
- `strict` — stricter local defaults without granting additional permissions.
- `security` — security-focused read-only reporting defaults.
- `node` — Node.js-oriented defaults.
- `python` — Python-oriented defaults.
- `wordpress` — WordPress-oriented defaults.

Examples:

```json
{
  "schemaVersion": 1,
  "extends": "security"
}
```

```json
{
  "schemaVersion": 1,
  "extends": "wordpress",
  "format": "json"
}
```

## Precedence

For non-security-sensitive settings, resolution is deterministic:

`explicit CLI/action input > project config > built-in preset > built-in default`

For example, a project may set `"format": "json"`, while an explicit CLI `--format markdown` still wins for commands that support those formats.

## Security boundary

Project configuration and presets cannot enable or grant write permission. Settings such as `allow-write` or `allowWrite` are rejected rather than inherited. Any operation that can write, merge, publish, or otherwise mutate external state still requires the command's explicit runtime authorization mechanism.

Provider credentials, API keys, tokens, and secrets are also excluded from project configuration. Credentials must be supplied at runtime through the supported environment or invocation mechanism; presets never inject credentials.

Unknown security-sensitive keys fail closed.

## Initialize a project

`aunoforge init` creates `.aunoforge/config.json` using the versioned safe contract. A dry run previews the same JSON without writing files:

```bash
aunoforge init --root . --dry-run
```

A newly initialized project starts with `schemaVersion: 1` and the `recommended` preset. The generated file does not contain write, merge, publish, token, or API-key authorization fields.
