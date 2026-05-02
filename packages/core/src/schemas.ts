import { z } from "zod"

import { formatNames, layoutNames, variantNames } from "./types"

export const MAX_SVG_BYTES = 2_000_000
export const MAX_RASTER_BYTES = 5_000_000
export const MAX_TEXT_LENGTH = 96
export const MAX_FONT_FAMILY_LENGTH = 80

export const colorPattern = /^(transparent|#[0-9a-fA-F]{6})$/

export const generateOptionsSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  secondaryText: z.string().trim().max(MAX_TEXT_LENGTH).optional().default(""),
  layout: z.enum(layoutNames).default("horizontal"),
  variant: z.enum(variantNames).default("color"),
  format: z.enum(formatNames).default("svg"),
  background: z.string().regex(colorPattern).default("transparent"),
  padding: z.number().int().min(32).max(160).default(80),
  filenameBase: z.string().trim().min(1).max(120).optional(),
  primaryFont: z.string().trim().min(1).max(MAX_FONT_FAMILY_LENGTH).optional(),
  secondaryFont: z.string().trim().min(1).max(MAX_FONT_FAMILY_LENGTH).optional(),
})

export const apiGenerateRequestSchema = generateOptionsSchema.extend({
  logo: z.string().max(MAX_RASTER_BYTES * 2).optional(),
  logoMimeType: z.enum(["image/svg+xml", "image/png"]).optional(),
})

export type GenerateOptions = z.infer<typeof generateOptionsSchema>
export type ApiGenerateRequest = z.infer<typeof apiGenerateRequestSchema>
