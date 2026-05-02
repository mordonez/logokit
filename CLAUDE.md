# CLAUDE.md

## Project

`logokit` is a public, local-first tool for generating brand lockups from arbitrary SVG or PNG logos.

## Workspace layout

- `apps/web`: Next.js one-page editor and `/api/generate`.
- `packages/core`: shared layout, sanitization, tracing, and export logic.
- `packages/cli`: `logokit` CLI.
- `README.md`: canonical user, API, and CLI documentation.
- `CONTRIBUTING.md`: contribution setup, checks, and rules.

## Guardrails

- Keep the product brand-agnostic.
- Do not reintroduce login, cookies, or institution-specific assets.
- Prefer changes in `packages/core` whenever behavior must stay aligned across web, API, and CLI.
- Validate visual/UI changes with Playwright before closing work.
