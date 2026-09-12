# Security Model

AunoForge follows one rule: **read broadly, write narrowly, execute almost nothing by default**.

## Untrusted inputs

Repository code, issues, pull requests, comments, recipes, and model output are untrusted. The fixed system policy is kept separate from untrusted content and secrets are redacted before normalized model context is constructed.

## Permissions

Safe mode allows read capabilities and denies repository writes, arbitrary network access, and shell execution. A recipe or provider cannot self-authorize writes. Human approval is represented by an in-process token that cannot be forged by model text.

## Fork pull requests

Fork diffs may be statically inspected. A request to execute tests does not run fork commands with privileged secrets; the decision is recorded in the audit stream.

## Evidence

Model findings are schema-validated, file/line references are checked against repository evidence, and impossible locations are downgraded. Deterministic checks are labeled separately from model findings.

For vulnerability reporting see [SECURITY.md](../../SECURITY.md).
