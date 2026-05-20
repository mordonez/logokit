import createDOMPurify from "dompurify"
import { JSDOM } from "jsdom"

import type { SanitizedSvg } from "./types"

const purifier = createDOMPurify(new JSDOM("").window)

const forbiddenTags = ["script", "foreignObject", "iframe", "audio", "video", "canvas"]

export function sanitizeSvg(svg: string): SanitizedSvg {
  const trimmed = svg.trim()
  if (!trimmed.includes("<svg")) {
    throw new Error("Logo SVG must contain a root <svg> element.")
  }

  const sanitized = purifier.sanitize(trimmed, {
    USE_PROFILES: { svg: true, svgFilters: true, html: false },
    ADD_TAGS: ["use"],
    ADD_ATTR: ["href", "xlink:href"],
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: ["onload", "onclick", "onerror", "onmouseover", "style"],
  })

  const dom = new JSDOM(`<body>${sanitized}</body>`)
  const svgElement = dom.window.document.querySelector("svg")
  if (!svgElement) {
    throw new Error("Logo SVG became empty after sanitization.")
  }

  const warnings = new Set<string>()
  for (const element of svgElement.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name)
        warnings.add("Removed inline event handlers from uploaded SVG.")
        continue
      }

      if ((name === "href" || name === "xlink:href") && value) {
        const allowed = value.startsWith("#") || value.startsWith("data:")
        if (!allowed) {
          element.removeAttribute(attribute.name)
          warnings.add("Removed external references from uploaded SVG.")
        } else if (name === "xlink:href") {
          element.setAttribute("href", value)
          element.removeAttribute(attribute.name)
        }
      }
    }
  }

  const output = svgElement.outerHTML
  return {
    svg: output,
    bytes: Buffer.byteLength(output),
    warnings: [...warnings],
    removedUnsafeContent: output !== trimmed,
  }
}
