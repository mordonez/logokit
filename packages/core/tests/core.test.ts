import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { generate, listLayouts, sanitizeSvg } from "../src"

const sampleLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" rx="18" fill="#10213A"/><circle cx="44" cy="40" r="18" fill="#E67B32"/></svg>`

describe("sanitizeSvg", () => {
  it("removes active content", () => {
    const result = sanitizeSvg(`<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script><rect width=\"40\" height=\"40\"/></svg>`)
    expect(result.svg).not.toContain("<script")
  })
})

describe("generate", () => {
  it("creates svg output with text converted to paths", async () => {
    const result = await generate({
      logo: sampleLogo,
      text: "Acme Labs",
      secondaryText: "Research Studio",
      layout: "horizontal",
      format: "svg",
    })

    expect(result.mimeType).toBe("image/svg+xml")
    expect(result.svg).toContain("<path")
    expect(result.svg).not.toContain("<text")
  })

  it("creates png output", async () => {
    const result = await generate({
      logo: sampleLogo,
      text: "Northwind",
      layout: "vertical",
      format: "png",
    })

    expect(result.mimeType).toBe("image/png")
    expect(result.buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  })

  it("loads bundled assets independently of cwd", async () => {
    const originalCwd = process.cwd()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "logokit-cwd-"))

    try {
      process.chdir(tempDir)

      const result = await generate({
        text: "Acme Labs",
        layout: "vertical",
        format: "png",
      })

      expect(result.mimeType).toBe("image/png")
      expect(result.buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    } finally {
      process.chdir(originalCwd)
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it("matches golden snapshots", async () => {
    const fixtures = await Promise.all([
      generate({ logo: sampleLogo, text: "Acme Labs", secondaryText: "Research Studio", layout: "horizontal", format: "svg" }),
      generate({ logo: sampleLogo, text: "Acme Labs", secondaryText: "Research Studio", layout: "vertical", format: "svg", variant: "mono-black" }),
      generate({ logo: sampleLogo, text: "Acme Labs", secondaryText: "Research Studio", layout: "stacked", format: "svg", background: "#10213A", variant: "mono-white" }),
    ])

    expect(fixtures.map((fixture) => fixture.svg)).toMatchSnapshot()
  })
})

describe("listLayouts", () => {
  it("exposes the public layout descriptors", () => {
    expect(listLayouts()).toHaveLength(3)
  })
})
