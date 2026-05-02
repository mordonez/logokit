import { z } from "zod"

const requestSchema = z.object({
  text: z.string().trim().min(1).max(96),
  secondaryText: z.string().trim().max(96).optional(),
  layout: z.enum(["horizontal", "vertical", "stacked"]).default("horizontal"),
  variant: z.enum(["color", "mono-black", "mono-white"]).default("color"),
  format: z.enum(["svg", "png"]).default("svg"),
  background: z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/).default("transparent"),
  logo: z.string().optional(),
  logoMimeType: z.enum(["image/svg+xml", "image/png"]).optional(),
})

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "logokit API",
      version: "1.0.0",
      description: "Generate brand lockups from arbitrary SVG or PNG logos.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/generate": {
        post: {
          description: "Generate a lockup as SVG or PNG.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.toJSONSchema(requestSchema),
              },
            },
          },
          responses: {
            "200": {
              description: "Generated asset.",
              content: {
                "image/svg+xml": {
                  schema: { type: "string", format: "binary" },
                },
                "image/png": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "400": { description: "Validation error." },
            "401": { description: "Authorization required." },
          },
        },
      },
    },
  }
}
