# `init`

Creates `.aunoforge/config.yml` with safe defaults after the CLI's explicit interactive approval boundary.

```bash
npx aunoforge init --root . --dry-run
npx aunoforge init --root .
```

Dry-run performs no write. Existing configuration is never overwritten by this command.
