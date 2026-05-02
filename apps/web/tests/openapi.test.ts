import { describe, expect, it } from "vitest"

import { buildOpenApiDocument } from "../lib/openapi"

describe("buildOpenApiDocument", () => {
  it("includes the generate endpoint", () => {
    const document = buildOpenApiDocument()
    expect(document.paths["/api/generate"]).toBeDefined()
  })
})
