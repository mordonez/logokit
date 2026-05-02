import { createHash } from "node:crypto"

import { createLayoutFrame, createTextFrame, listLayouts as listLayoutsInternal } from "./layouts"
import { loadFontKit, normalizeLogo } from "./assets"
import { generateOptionsSchema } from "./schemas"
import type { GenerateInput, GenerateResult, LayoutDescriptor, VariantName } from "./types"

function buildGlyphPathData(
  font: Awaited<ReturnType<typeof loadFontKit>>["regular"],
  text: string,
  startX: number,
  baselineY: number,
  fontSize: number,
) {
  const glyphs = [...text].map((character) => font.charToGlyph(character))
  const scale = fontSize / font.unitsPerEm
  let currentX = startX

  return glyphs.map((glyph, index) => {
    const pathData = glyph.getPath(currentX, baselineY, fontSize).toPathData(3)
    const nextGlyph = glyphs[index + 1]
    const kerning = nextGlyph ? font.getKerningValue(glyph, nextGlyph) : 0
    currentX += ((glyph.advanceWidth ?? 0) + kerning) * scale
    return pathData
  }).join("")
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "lockup"
}

function monoFilterMarkup(color: string) {
  return `<filter id="mono-logo" color-interpolation-filters="sRGB"><feFlood flood-color="${color}" result="paint"/><feComposite in="paint" in2="SourceAlpha" operator="in"/></filter>`
}

function logoMarkup(logo: Awaited<ReturnType<typeof normalizeLogo>>, variant: VariantName, frame: ReturnType<typeof createLayoutFrame>) {
  const [minX, minY, viewWidth, viewHeight] = logo.viewBox
  const scaleX = frame.logo.width / viewWidth
  const scaleY = frame.logo.height / viewHeight
  const filter = variant === "color" ? "" : " filter=\"url(#mono-logo)\""

  if (logo.kind === "svg") {
    return `<g${filter} transform="translate(${frame.logo.x} ${frame.logo.y}) scale(${scaleX} ${scaleY}) translate(${-minX} ${-minY})">${logo.innerMarkup}</g>`
  }

  return `<image x="${frame.logo.x}" y="${frame.logo.y}" width="${frame.logo.width}" height="${frame.logo.height}" href="${logo.dataUrl}" preserveAspectRatio="xMidYMid meet"${filter}/>`
}

export async function renderSvg(input: GenerateInput) {
  const options = generateOptionsSchema.parse({
    text: input.text,
    secondaryText: input.secondaryText ?? "",
    layout: input.layout,
    variant: input.variant,
    format: input.format,
    background: input.background,
    padding: input.padding,
    filenameBase: input.filenameBase,
  })

  const [fonts, logo] = await Promise.all([
    loadFontKit(),
    normalizeLogo(input.logo, input.logoMimeType),
  ])

  const textFrame = createTextFrame(options.layout, options.text, options.secondaryText, fonts)
  const frame = createLayoutFrame(options.layout, logo.width, logo.height, textFrame, options.padding)
  const textColor = options.variant === "mono-white" ? "#FFFFFF" : "#111827"
  const background = options.background
  const defs = options.variant === "color" ? "" : `<defs>${monoFilterMarkup(textColor)}</defs>`
  const backgroundRect = background === "transparent"
    ? ""
    : `<rect width="100%" height="100%" fill="${background}"/>`

  const paths = frame.lines.map((line) => {
    const font = line.weight === "bold" ? fonts.bold : fonts.regular
    const pathData = buildGlyphPathData(font, line.text, line.x, line.baselineY, line.fontSize)
    return `<path d="${pathData}" fill="${textColor}"/>`
  }).join("")

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" fill="none" role="img" aria-label="${options.text}">`,
    defs,
    backgroundRect,
    logoMarkup(logo, options.variant, frame),
    paths,
    `</svg>`,
  ].join("")

  return {
    svg,
    width: frame.width,
    height: frame.height,
    filename: `${options.filenameBase ?? slugify(`${options.text} ${options.secondaryText}`)}-${options.layout}-${options.variant}`,
    warnings: logo.warnings,
  }
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const format = input.format ?? "svg"
  const rendered = await renderSvg(input)
  const svgBuffer = Buffer.from(rendered.svg)

  if (format === "svg") {
    return {
      format,
      mimeType: "image/svg+xml",
      buffer: svgBuffer,
      width: rendered.width,
      height: rendered.height,
      filename: `${rendered.filename}.svg`,
      hash: createHash("sha256").update(svgBuffer).digest("hex"),
      svg: rendered.svg,
    }
  }

  const { Resvg } = await import("@resvg/resvg-js")
  const resvg = new Resvg(rendered.svg, {
    fitTo: {
      mode: "width",
      value: rendered.width * 2,
    },
  })
  const pngBuffer = Buffer.from(resvg.render().asPng())

  return {
    format,
    mimeType: "image/png",
    buffer: pngBuffer,
    width: rendered.width * 2,
    height: Math.round(rendered.height * 2),
    filename: `${rendered.filename}.png`,
    hash: createHash("sha256").update(pngBuffer).digest("hex"),
    svg: rendered.svg,
  }
}

export function listLayouts(): LayoutDescriptor[] {
  return listLayoutsInternal()
}
