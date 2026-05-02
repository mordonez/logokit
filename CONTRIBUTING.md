# Contributing

## Setup

```bash
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Rules

- Keep the product brand-agnostic.
- Route shared rendering behavior through `packages/core`.
- Add or update snapshots when layout output changes.
- Validate visual changes with Playwright before merging.
