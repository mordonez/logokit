import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { imageSize } from "image-size"

import { MAX_RASTER_BYTES, MAX_SVG_BYTES } from "./schemas"
import { sanitizeSvg } from "./sanitize"
import { bundledFontNames, type BundledFontName } from "./types"

export interface FontKit {
  regular: import("opentype.js").Font
  bold: import("opentype.js").Font
}

export interface NormalizedLogo {
  kind: "svg" | "raster"
  width: number
  height: number
  viewBox: [number, number, number, number]
  innerMarkup?: string
  rootAttributes?: string
  dataUrl?: string
  warnings: string[]
}

function resolveAssetsRoot() {
  const candidates: string[] = []

  const moduleUrl = typeof import.meta !== "undefined" ? import.meta.url : undefined
  if (moduleUrl?.startsWith("file:")) {
    const moduleDir = path.dirname(fileURLToPath(moduleUrl))
    candidates.push(path.join(moduleDir, "..", "assets"))
    candidates.push(path.join(moduleDir, "assets"))
  }

  let currentDir = process.cwd()

  while (true) {
    candidates.push(path.join(currentDir, "packages", "core", "assets"))
    candidates.push(path.join(currentDir, "assets"))
    candidates.push(path.join(currentDir, "node_modules", "@mordonezdev", "logokit-core", "assets"))

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  const existing = candidates.find((candidate) => existsSync(candidate))
  if (!existing) {
    throw new Error(`Unable to resolve logokit-core assets. Checked: ${candidates.join(", ")}`)
  }

  return existing
}

let defaultLogoPromise: Promise<string> | undefined

export function resolveAssetPath(...segments: string[]) {
  return path.join(resolveAssetsRoot(), ...segments)
}

export async function loadDefaultLogo() {
  if (!defaultLogoPromise) {
    defaultLogoPromise = readFile(resolveAssetPath("default-logo.svg"), "utf8").catch((err) => {
      defaultLogoPromise = undefined
      throw err
    })
  }

  return defaultLogoPromise
}

function toArrayBuffer(buffer: Buffer) {
  const bytes = Uint8Array.from(buffer)
  return bytes.buffer as ArrayBuffer
}

export async function loadFontFiles() {
  const [regular, bold] = await Promise.all([
    readFile(resolveAssetPath("fonts", "Inter-Regular.woff")),
    readFile(resolveAssetPath("fonts", "Inter-Bold.woff")),
  ])

  return { regular, bold }
}

export async function loadFontKit() {
  const opentypeModule = await import("opentype.js") as {
    parse?: (buffer: ArrayBuffer) => import("opentype.js").Font
    default?: {
      parse: (buffer: ArrayBuffer) => import("opentype.js").Font
    }
  }
  const opentype = opentypeModule.parse ? opentypeModule : opentypeModule.default
  if (!opentype?.parse) {
    throw new Error("Unable to load opentype.js parser.")
  }
  const { regular, bold } = await loadFontFiles()

  return {
    regular: opentype.parse(toArrayBuffer(regular)),
    bold: opentype.parse(toArrayBuffer(bold)),
  }
}

// ─── Font family resolution ──────────────────────────────────────────────────

const bundledFontFileMap: Record<BundledFontName, { regular: string; bold: string }> = {
  "Inter":              { regular: "Inter-Regular.woff",             bold: "Inter-Bold.woff" },
  "Plus Jakarta Sans":  { regular: "PlusJakartaSans-Regular.woff",   bold: "PlusJakartaSans-Bold.woff" },
  "DM Sans":            { regular: "DMSans-Regular.woff",            bold: "DMSans-Bold.woff" },
  "Outfit":             { regular: "Outfit-Regular.woff",            bold: "Outfit-Bold.woff" },
  "Geist":              { regular: "Geist-Regular.woff",             bold: "Geist-Bold.woff" },
}

// In-memory cache: font family name → parsed opentype Font pair
const fontKitCache = new Map<string, FontKit>()

function isBundledFont(name: string): name is BundledFontName {
  return (bundledFontNames as readonly string[]).includes(name)
}

async function parseFont(buffer: Buffer): Promise<import("opentype.js").Font> {
  const opentypeModule = await import("opentype.js") as {
    parse?: (buffer: ArrayBuffer) => import("opentype.js").Font
    default?: { parse: (buffer: ArrayBuffer) => import("opentype.js").Font }
  }
  const opentype = opentypeModule.parse ? opentypeModule : opentypeModule.default
  if (!opentype?.parse) throw new Error("Unable to load opentype.js parser.")
  return opentype.parse(toArrayBuffer(buffer))
}

async function loadBundledFontKit(name: BundledFontName): Promise<FontKit> {
  const files = bundledFontFileMap[name]
  const [regular, bold] = await Promise.all([
    readFile(resolveAssetPath("fonts", files.regular)),
    readFile(resolveAssetPath("fonts", files.bold)),
  ])
  return {
    regular: await parseFont(regular),
    bold: await parseFont(bold),
  }
}

/**
 * Fetch a single font weight from the Google Fonts CSS1 API.
 * Uses a pre-woff2 User-Agent so Google Fonts responds with woff, which
 * opentype.js can parse natively (woff2 is NOT supported by opentype.js).
 */
async function fetchGoogleFont(family: string, weight: 400 | 700): Promise<Buffer | null> {
  try {
    const encoded = encodeURIComponent(family)
    // CSS v1 API + old Firefox UA → Google Fonts returns woff (not woff2)
    const cssUrl = `https://fonts.googleapis.com/css?family=${encoded}:${weight}`
    const cssRes = await fetch(cssUrl, {
      headers: {
        // Firefox 27 (Jan 2014) supported woff but predates woff2 (mid-2014)
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:27.0) Gecko/20100101 Firefox/27.0",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!cssRes.ok) return null
    const css = await cssRes.text()
    // Match url(...) followed by format('woff') — Google Fonts serves woff
    // from query-string URLs that don't end in .woff
    const match = css.match(/url\(([^)]+)\)\s*format\(['"]woff['"]\)/)
    if (!match) return null
    const fontRes = await fetch(match[1], { signal: AbortSignal.timeout(15000) })
    if (!fontRes.ok) return null
    return Buffer.from(await fontRes.arrayBuffer())
  } catch {
    return null
  }
}

async function loadGoogleFontKit(family: string): Promise<FontKit | null> {
  const [regularBuf, boldBuf] = await Promise.all([
    fetchGoogleFont(family, 400),
    fetchGoogleFont(family, 700),
  ])
  if (!regularBuf || !boldBuf) return null
  return {
    regular: await parseFont(regularBuf),
    bold: await parseFont(boldBuf),
  }
}

/**
 * Resolve a FontKit for the given font family name.
 * Resolution order: bundled → Google Fonts (if network available) → Inter fallback.
 */
export async function resolveFontKit(family: string): Promise<FontKit> {
  const normalised = family.trim()
  if (!normalised) return loadFontKit()

  const cached = fontKitCache.get(normalised)
  if (cached) return cached

  let kit: FontKit | null = null

  if (isBundledFont(normalised)) {
    kit = await loadBundledFontKit(normalised)
  } else {
    kit = await loadGoogleFontKit(normalised)
  }

  if (!kit) {
    // Fallback to Inter
    kit = await loadFontKit()
  }

  fontKitCache.set(normalised, kit)
  return kit
}

export function listBundledFonts(): BundledFontName[] {
  return [...bundledFontNames]
}

function parseDataUrl(source: string) {
  const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  }
}

function inferMimeType(value: string | Uint8Array | Buffer, provided?: string) {
  if (provided) {
    return provided
  }

  if (typeof value === "string") {
    if (value.trim().startsWith("<svg")) {
      return "image/svg+xml"
    }

    const dataUrl = parseDataUrl(value)
    if (dataUrl) {
      return dataUrl.mimeType
    }
  }

  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value)
  if (buffer.subarray(0, 4).toString("hex") === "89504e47") {
    return "image/png"
  }

  if (buffer.subarray(0, 3).toString() === "<sv") {
    return "image/svg+xml"
  }

  throw new Error("Unable to infer uploaded logo type.")
}

const inheritedPresentationAttributes = new Set([
  "clip-rule",
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "vector-effect",
])

function extractSvgPieces(svg: string, fallbackWidth: number, fallbackHeight: number) {
  const openTag = svg.match(/<svg\b([^>]*)>/i)
  if (!openTag) {
    throw new Error("Sanitized SVG is missing an opening tag.")
  }

  const innerMarkup = svg.replace(/^.*?<svg\b[^>]*>/is, "").replace(/<\/svg>\s*$/i, "")
  const rootAttributes = [...openTag[1].matchAll(/([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)]
    .map((match) => ({
      name: match[1].toLowerCase(),
      value: match[3] ?? match[4] ?? "",
    }))
    .filter((attribute) => inheritedPresentationAttributes.has(attribute.name))
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .join(" ")
  const viewBoxMatch = openTag[1].match(/viewBox=["']([^"']+)["']/i)
  const viewBox = viewBoxMatch
    ? viewBoxMatch[1].split(/\s+/).map(Number)
    : [0, 0, fallbackWidth, fallbackHeight]

  if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    return {
      innerMarkup,
      rootAttributes,
      viewBox: [0, 0, fallbackWidth, fallbackHeight] as [number, number, number, number],
    }
  }

  return {
    innerMarkup,
    rootAttributes,
    viewBox: viewBox as [number, number, number, number],
  }
}

export async function normalizeLogo(input?: string | Uint8Array | Buffer, mimeType?: string): Promise<NormalizedLogo> {
  const source = input ?? (await loadDefaultLogo())
  const resolvedMimeType = inferMimeType(source, mimeType)

  if (resolvedMimeType === "image/svg+xml") {
    const svgMarkup = typeof source === "string"
      ? parseDataUrl(source)?.buffer?.toString("utf8") ?? source
      : Buffer.from(source).toString("utf8")
    const sanitized = sanitizeSvg(svgMarkup)

    if (sanitized.bytes > MAX_SVG_BYTES) {
      throw new Error(`SVG logos are limited to ${MAX_SVG_BYTES} bytes.`)
    }

    const dimensions = imageSize(Buffer.from(sanitized.svg))
    const width = dimensions.width ?? 240
    const height = dimensions.height ?? 240
    const pieces = extractSvgPieces(sanitized.svg, width, height)

    return {
      kind: "svg",
      width,
      height,
      viewBox: pieces.viewBox,
      innerMarkup: pieces.innerMarkup,
      rootAttributes: pieces.rootAttributes,
      warnings: sanitized.warnings,
    }
  }

  if (resolvedMimeType !== "image/png") {
    throw new Error("Only SVG and PNG logos are supported in v1.")
  }

  const data = typeof source === "string" ? parseDataUrl(source)?.buffer : Buffer.from(source)
  if (!data) {
    throw new Error("PNG logos must be provided as raw bytes or data URLs.")
  }

  if (data.byteLength > MAX_RASTER_BYTES) {
    throw new Error(`PNG logos are limited to ${MAX_RASTER_BYTES} bytes.`)
  }

  const dimensions = imageSize(data)
  if (!dimensions.width || !dimensions.height) {
    throw new Error("PNG logo dimensions could not be determined.")
  }

  return {
    kind: "raster",
    width: dimensions.width,
    height: dimensions.height,
    viewBox: [0, 0, dimensions.width, dimensions.height],
    dataUrl: `data:image/png;base64,${data.toString("base64")}`,
    warnings: [],
  }
}
