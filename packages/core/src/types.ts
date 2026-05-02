export const layoutNames = ["horizontal", "vertical", "stacked"] as const
export const variantNames = ["color", "mono-black", "mono-white"] as const
export const formatNames = ["svg", "png"] as const

export type LayoutName = (typeof layoutNames)[number]
export type VariantName = (typeof variantNames)[number]
export type OutputFormat = (typeof formatNames)[number]

export interface GenerateInput {
  text: string
  secondaryText?: string
  logo?: string | Uint8Array | Buffer
  logoMimeType?: string
  layout?: LayoutName
  variant?: VariantName
  format?: OutputFormat
  background?: string
  padding?: number
  filenameBase?: string
}

export interface GenerateResult {
  format: OutputFormat
  mimeType: string
  buffer: Buffer
  width: number
  height: number
  filename: string
  hash: string
  svg?: string
}

export interface LayoutDescriptor {
  name: LayoutName
  label: string
  description: string
  previewSvg: string
}

export interface SanitizedSvg {
  svg: string
  bytes: number
  warnings: string[]
  removedUnsafeContent: boolean
}
