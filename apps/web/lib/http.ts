import type { NextRequest } from "next/server"

export function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigins = (process.env.LOGOKIT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const allowOrigin = !origin
    ? "*"
    : allowedOrigins.length === 0 || allowedOrigins.includes(origin)
      ? origin
      : "null"

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
}

export function hasApiAccess(request: NextRequest) {
  const configuredKey = process.env.LOGOKIT_API_KEY?.trim()
  if (!configuredKey) {
    return true
  }

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader
  if (bearerToken === configuredKey) {
    return true
  }

  const origin = request.headers.get("origin")
  return Boolean(origin && origin === request.nextUrl.origin)
}
