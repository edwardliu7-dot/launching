---
name: Deployment package manager
description: The workspace rule for keeping pnpm frozen installs reproducible across external deployment builders.
---

Keep the repository's package manager version explicitly pinned to the pnpm version used to generate and validate `pnpm-lock.yaml`.

**Why:** External builders such as Coolify/Railpack may otherwise resolve `pnpm@latest`; changes in pnpm's workspace and override validation can make `pnpm install --frozen-lockfile` fail before the application build starts.

**How to apply:** When dependency configuration or workspace overrides change, regenerate/validate the lockfile with the pinned pnpm version and test the exact deployment package build command.