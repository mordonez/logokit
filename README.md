# logokit

Generate brand lockups from any logo. `logokit` ships as a one-page web app, an HTTP API, and a CLI backed by the same rendering core.

## Quickstart

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:8080`. Requires Node.js 20+ and pnpm 10+.

## What ships in this repo

- `apps/web`: public one-page editor and the `/api/generate` HTTP surface.
- `packages/core`: shared rendering, layout, sanitization, and export pipeline.
- `packages/cli`: `logokit` command for local and CI workflows.

## Core features

- SVG or PNG logo input with sanitization and size limits.
- Three lockup presets: horizontal, vertical, and stacked.
- SVG and PNG export with text converted to paths.
- Optional API key protection for self-hosted HTTP deployments.
- Shared fixtures and parity tests across web, core, and CLI.

## Usage

### Web

```bash
pnpm dev
```

Open `http://localhost:8080`, upload an SVG or PNG logo, enter primary and optional secondary text, choose a layout and appearance, then download SVG or PNG.

Input limits:

- SVG: 2 MB maximum.
- PNG: 5 MB maximum.
- Text fields: 96 characters each.

SVG is the default export because text is converted to paths, so the output stays consistent even when the recipient does not have the source font installed.

### CLI

```bash
npx @mordonezdev/logokit --text "Acme Labs" --out ./acme.svg
```

Common commands:

```bash
npx @mordonezdev/logokit --logo ./brand.svg --text "Acme Labs" --layout vertical --format png --out ./acme.png
npx @mordonezdev/logokit batch ./teams.csv --out-dir ./out --manifest
npx @mordonezdev/logokit layouts
npx @mordonezdev/logokit doctor
```

Notes:

- `--json` prints metadata including the SHA256 hash.
- `batch` accepts CSV or JSON input.
- `init` creates a starter `logokit.config.json` file.

### HTTP API

`POST /api/generate` accepts JSON or multipart form data. If `LOGOKIT_API_KEY` is configured, cross-origin callers must send `Authorization: Bearer <key>`.

```bash
curl -X POST http://localhost:8080/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"text":"Acme Labs","layout":"horizontal","format":"svg"}'
```

JSON shape:

```json
{
  "text": "Acme Labs",
  "secondaryText": "Research Studio",
  "layout": "horizontal",
  "variant": "color",
  "format": "svg",
  "background": "transparent",
  "logo": "<svg ...>",
  "logoMimeType": "image/svg+xml"
}
```

Response content type is `image/svg+xml` for `format=svg` and `image/png` for `format=png`. The generated OpenAPI document is available at `/api/openapi.json`.

## Environment

Copy `.env.example` to `.env.local` only if you want to enable API protection or tweak allowed origins.

## Contributing

```bash
pnpm typecheck
pnpm test
pnpm build
```

Rules:

- Keep the product brand-agnostic.
- Route shared rendering behavior through `packages/core`.
- Add or update snapshots when layout output changes.
- Validate visual changes with Playwright before merging.

## License

MIT. See `LICENSE` and `NOTICE`.
