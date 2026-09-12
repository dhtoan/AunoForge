# Architecture Overview

AunoForge is a hybrid CLI + GitHub Action built around a provider-neutral core.

```text
CLI / GitHub Action
       |
       +-- Recipes -- capability declarations
       +-- GitHub reader -- read-only repository metadata
       +-- Providers -- mock / Codex / Claude
       |
     Core contracts + policy + validation
       |
 Evidence verification + normalization
       |
 Terminal / Markdown / JSON reporters
```

The core does not import GitHub UI concerns or provider-specific response formats. Recipes are declarative. Provider responses are structured and validated. Write behavior sits behind explicit policy/approval boundaries, and destructive automation is out of scope for v0.1.0.

See [Security](../concepts/security.md), [Providers](../concepts/providers.md), and [Recipes](../concepts/recipes.md).
