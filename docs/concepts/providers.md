# Providers

AunoForge core talks to the `AunoForgeProvider` contract rather than a vendor-specific payload. All findings still pass through AunoForge validation and evidence handling.

## Mock

`--provider mock` performs no external model request and is the default safe development provider.

## Codex / OpenAI

Set `OPENAI_API_KEY`, choose `--provider codex`, and provide `--model <model-name>` (or `AUNOFORGE_MODEL`). The adapter uses the OpenAI Responses API with structured output and `store: false`.

## Claude / Anthropic

Set `ANTHROPIC_API_KEY`, choose `--provider claude`, and provide `--model <model-name>` (or `AUNOFORGE_MODEL`). The adapter uses the Anthropic Messages API with structured output.

Model names are configuration, not hard-coded project policy, because available models change over time. Credentials are isolated inside the selected adapter and are not copied into normalized repository context.
