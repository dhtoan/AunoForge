# Security Policy

## Supported version

During the pre-1.0 phase, the latest published minor line is the supported security target. Security fixes may require upgrading to the newest release.

## Reporting a vulnerability

Do **not** open a public issue containing exploit details, secrets, private repository data, or a working proof of compromise. Prefer GitHub's private security advisory / private vulnerability reporting channel for this repository. If that channel is unavailable, contact the maintainer privately through the GitHub account before sharing sensitive details.

A useful report includes affected version/commit, impact, reproduction conditions, and a minimal safe proof. Never send real credentials.

## Security boundaries

AunoForge treats repository content, issue and pull-request text, comments, community recipes, and model output as untrusted. The project maintains explicit regression tests for permission escalation, prompt injection boundaries, credential redaction, read-only mutation, path traversal, fork-PR execution, provider schema validation, GitHub writes, and human approval.

See [docs/concepts/security.md](docs/concepts/security.md) for the architecture-level model.
