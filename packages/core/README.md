# @mordonezdev/logokit-core

Shared rendering core for [logokit](https://github.com/mordonez/logokit): brand-agnostic logo lockup generation, SVG sanitization, and SVG/PNG export. Used by the logokit web app, HTTP API, and CLI.

## Install

```bash
npm install @mordonezdev/logokit-core
```

## Usage

```ts
import { generate, listLayouts } from "@mordonezdev/logokit-core"

const layouts = listLayouts()

const result = await generate({
  text: "Acme Labs",
  secondaryText: "Research Studio",
  layout: "horizontal",
  variant: "color",
  format: "svg",
})

// result.buffer (Uint8Array), result.mimeType, result.filename
```

See the [main repository](https://github.com/mordonez/logokit) for full documentation.

## License

MIT
