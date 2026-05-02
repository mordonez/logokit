# @mordonezdev/logokit-core

Internal workspace package for [logokit](https://github.com/mordonez/logokit): brand-agnostic logo lockup generation, SVG sanitization, and SVG/PNG export. It is used by the web app, HTTP API, and CLI, but it is not published separately to npm.

## Workspace usage

Import it from the workspace packages inside this monorepo rather than from npm.

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

The only public npm package is `@mordonezdev/logokit`.

## License

MIT
