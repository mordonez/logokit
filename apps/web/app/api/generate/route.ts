import { type NextRequest } from "next/server"
import { ZodError } from "zod"

import { generate } from "@mordonezdev/logokit-core"

import { getCorsHeaders, hasApiAccess } from "../../../lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 10

function jsonError(request: NextRequest, message: string, status: number) {
  return Response.json({ error: message }, { status, headers: getCorsHeaders(request) })
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const file = formData.get("logo")
    const logo = file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined

    return {
      text: String(formData.get("text") ?? ""),
      secondaryText: String(formData.get("secondaryText") ?? ""),
      layout: String(formData.get("layout") ?? "horizontal"),
      variant: String(formData.get("variant") ?? "color"),
      format: String(formData.get("format") ?? "svg"),
      background: String(formData.get("background") ?? "transparent"),
      logo,
      logoMimeType: file instanceof File ? file.type : undefined,
      primaryFont: formData.get("primaryFont") ? String(formData.get("primaryFont")) : undefined,
      secondaryFont: formData.get("secondaryFont") ? String(formData.get("secondaryFont")) : undefined,
    }
  }

  const body = await request.json()
  return {
    text: body.text,
    secondaryText: body.secondaryText,
    layout: body.layout,
    variant: body.variant,
    format: body.format,
    background: body.background,
    logo: body.logo,
    logoMimeType: body.logoMimeType,
    primaryFont: body.primaryFont,
    secondaryFont: body.secondaryFont,
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { headers: getCorsHeaders(request) })
}

export async function POST(request: NextRequest) {
  if (!hasApiAccess(request)) {
    return jsonError(request, "A valid API key is required for cross-origin API access.", 401)
  }

  try {
    const input = await parseRequest(request)
    const result = await generate(input)

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        ...getCorsHeaders(request),
        "Cache-Control": "no-store",
        "Content-Type": result.mimeType,
        "Content-Disposition": `inline; filename=\"${result.filename}\"`,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Request validation failed.", details: error.issues },
        { status: 400, headers: getCorsHeaders(request) },
      )
    }

    return jsonError(request, error instanceof Error ? error.message : "Failed to generate asset.", 400)
  }
}
