import { apiGenerateRequestSchema } from "@mordonezdev/logokit-core"
import { z } from "zod"

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
                schema: z.toJSONSchema(apiGenerateRequestSchema),
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
