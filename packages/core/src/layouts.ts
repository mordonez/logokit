import type { Font } from "opentype.js"

import { layoutNames, type LayoutDescriptor, type LayoutName } from "./types"

interface WrappedLine {
  text: string
  width: number
  fontSize: number
  weight: "regular" | "bold"
  fieldType: "primary" | "secondary"
}

interface LayoutPreset {
  paddingX: number
  paddingY: number
  gap: number
  primarySize: number
  secondarySize: number
  lineHeight: number
  logoMaxWidth: number
  logoMaxHeight: number
  textMaxWidth: number
  align: "left" | "center"
  stackedTextAlign?: "left" | "center"
}

export interface TextFrame {
  lines: WrappedLine[]
  blockWidth: number
  blockHeight: number
}

export interface LayoutFrame {
  width: number
  height: number
  logo: { x: number; y: number; width: number; height: number }
  lines: Array<WrappedLine & { x: number; baselineY: number }>
}

const layoutPresets: Record<LayoutName, LayoutPreset> = {
  horizontal: {
    paddingX: 88,
    paddingY: 76,
    gap: 58,
    primarySize: 78,
    secondarySize: 78,
    lineHeight: 1.05,
    logoMaxWidth: 300,
    logoMaxHeight: 208,
    textMaxWidth: 820,
    align: "left",
  },
  vertical: {
    paddingX: 80,
    paddingY: 88,
    gap: 48,
    primarySize: 72,
    secondarySize: 72,
    lineHeight: 1.08,
    logoMaxWidth: 360,
    logoMaxHeight: 220,
    textMaxWidth: 760,
    align: "center",
  },
  stacked: {
    paddingX: 80,
    paddingY: 88,
    gap: 34,
    primarySize: 68,
    secondarySize: 68,
    lineHeight: 1.06,
    logoMaxWidth: 420,
    logoMaxHeight: 196,
    textMaxWidth: 840,
    align: "left",
  },
}

const previewMap: Record<LayoutName, string> = {
  horizontal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" fill="none"><rect width="220" height="120" rx="24" fill="#F5EFE6"/><rect x="18" y="24" width="56" height="72" rx="14" fill="#10213A"/><rect x="96" y="34" width="86" height="16" rx="8" fill="#10213A" opacity=".88"/><rect x="96" y="58" width="108" height="18" rx="9" fill="#E67B32" opacity=".92"/></svg>`,
  vertical: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" fill="none"><rect width="220" height="120" rx="24" fill="#EEF2FF"/><rect x="79" y="18" width="62" height="46" rx="14" fill="#10213A"/><rect x="53" y="80" width="114" height="14" rx="7" fill="#10213A" opacity=".88"/></svg>`,
  stacked: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" fill="none"><rect width="220" height="120" rx="24" fill="#F5EFE6"/><rect x="20" y="18" width="98" height="38" rx="12" fill="#10213A"/><rect x="20" y="74" width="126" height="14" rx="7" fill="#10213A" opacity=".88"/><rect x="20" y="94" width="148" height="14" rx="7" fill="#E67B32" opacity=".92"/></svg>`,
}

const layoutCopy: Record<LayoutName, { label: string; description: string }> = {
  horizontal: {
    label: "Horizontal",
    description: "Logo on the left, text block on the right.",
  },
  vertical: {
    label: "Vertical",
    description: "Centered logo over centered text.",
  },
  stacked: {
    label: "Stacked",
    description: "Compact lockup with the text anchored under the mark.",
  },
}

function measure(font: Font, text: string, fontSize: number) {
  const glyphs = [...text].map((character) => font.charToGlyph(character))
  const scale = fontSize / font.unitsPerEm

  return glyphs.reduce((width, glyph, index) => {
    const nextGlyph = glyphs[index + 1]
    const kerning = nextGlyph ? font.getKerningValue(glyph, nextGlyph) : 0
    return width + ((glyph.advanceWidth ?? 0) + kerning) * scale
  }, 0)
}

function wrapWords(text: string, font: Font, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(font, candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }

    if (!current) {
      let chunk = ""
      for (const character of word) {
        const attempt = chunk + character
        if (!chunk || measure(font, attempt, fontSize) <= maxWidth) {
          chunk = attempt
          continue
        }

        lines.push(chunk)
        chunk = character
      }

      current = chunk
      continue
    }

    lines.push(current)
    current = word
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

export function createTextFrame(
  layout: LayoutName,
  text: string,
  secondaryText: string,
  primaryFonts: { regular: Font; bold: Font },
  secondaryFonts: { regular: Font; bold: Font } = primaryFonts,
) {
  const preset = layoutPresets[layout]
  const normalizedPrimary = text.trim()
  const normalizedSecondary = secondaryText.trim()
  const primaryWeight: "regular" | "bold" = normalizedSecondary ? "regular" : "bold"
  const primaryFont = primaryWeight === "bold" ? primaryFonts.bold : primaryFonts.regular

  const primaryLines = normalizedPrimary
    .split(/\n+/)
    .flatMap((segment) => wrapWords(segment.trim(), primaryFont, preset.primarySize, preset.textMaxWidth))
    .filter(Boolean)
    .map((line) => ({
      text: line,
      width: measure(primaryFont, line, preset.primarySize),
      fontSize: preset.primarySize,
      weight: primaryWeight,
      fieldType: "primary" as const,
    }))

  const secondaryLines = normalizedSecondary
    .split(/\n+/)
    .flatMap((segment) => wrapWords(segment.trim(), secondaryFonts.bold, preset.secondarySize, preset.textMaxWidth))
    .filter(Boolean)
    .map((line) => ({
      text: line,
      width: measure(secondaryFonts.bold, line, preset.secondarySize),
      fontSize: preset.secondarySize,
      weight: "bold" as const,
      fieldType: "secondary" as const,
    }))

  const lines = [...primaryLines, ...secondaryLines]
  const blockWidth = lines.reduce((largest, line) => Math.max(largest, line.width), 0)
  const lineCount = lines.length || 1
  const lineHeight = Math.round(Math.max(preset.primarySize, preset.secondarySize) * preset.lineHeight)
  const blockHeight = lineCount * lineHeight

  return { lines, blockWidth, blockHeight }
}

export function createLayoutFrame(
  layout: LayoutName,
  logoWidth: number,
  logoHeight: number,
  textFrame: TextFrame,
  paddingOverride?: number,
): LayoutFrame {
  const preset = layoutPresets[layout]
  const paddingX = paddingOverride ?? preset.paddingX
  const paddingY = paddingOverride ?? preset.paddingY
  const logoScale = Math.min(preset.logoMaxWidth / logoWidth, preset.logoMaxHeight / logoHeight)
  const scaledLogoWidth = Math.round(logoWidth * logoScale)
  const scaledLogoHeight = Math.round(logoHeight * logoScale)
  const lineHeight = Math.round(Math.max(preset.primarySize, preset.secondarySize) * preset.lineHeight)

  if (layout === "horizontal") {
    const width = Math.ceil(paddingX * 2 + scaledLogoWidth + preset.gap + textFrame.blockWidth)
    const height = Math.ceil(paddingY * 2 + Math.max(scaledLogoHeight, textFrame.blockHeight))
    const innerHeight = height - paddingY * 2
    const logoY = paddingY + (innerHeight - scaledLogoHeight) / 2
    const textStartX = paddingX + scaledLogoWidth + preset.gap
    const textStartY = paddingY + (innerHeight - textFrame.blockHeight) / 2 + lineHeight * 0.9

    return {
      width,
      height,
      logo: {
        x: paddingX,
        y: Math.round(logoY),
        width: scaledLogoWidth,
        height: scaledLogoHeight,
      },
      lines: textFrame.lines.map((line, index) => ({
        ...line,
        x: textStartX,
        baselineY: Math.round(textStartY + index * lineHeight),
      })),
    }
  }

  const contentWidth = Math.max(scaledLogoWidth, textFrame.blockWidth)
  const width = Math.ceil(paddingX * 2 + contentWidth)
  const height = Math.ceil(paddingY * 2 + scaledLogoHeight + preset.gap + textFrame.blockHeight)
  const logoX = layout === "stacked" ? paddingX : paddingX + (contentWidth - scaledLogoWidth) / 2
  const textStartY = paddingY + scaledLogoHeight + preset.gap + lineHeight * 0.9

  return {
    width,
    height,
    logo: {
      x: Math.round(logoX),
      y: paddingY,
      width: scaledLogoWidth,
      height: scaledLogoHeight,
    },
    lines: textFrame.lines.map((line, index) => {
      const x = preset.align === "center"
        ? paddingX + (contentWidth - line.width) / 2
        : paddingX

      return {
        ...line,
        x: Math.round(x),
        baselineY: Math.round(textStartY + index * lineHeight),
      }
    }),
  }
}

export function listLayouts(): LayoutDescriptor[] {
  return layoutNames.map((name) => ({
    name,
    label: layoutCopy[name].label,
    description: layoutCopy[name].description,
    previewSvg: previewMap[name],
  }))
}
