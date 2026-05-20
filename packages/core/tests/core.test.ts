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

  it("preserves local symbol references and removes external references", () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20">
        <defs><path id="mark" d="M0 0h10v10H0z" fill="#ffb13b"/></defs>
        <use xlink:href="#mark"/>
        <use href="https://example.com/remote.svg#mark"/>
      </svg>
    `)

    expect(result.svg).toContain("<use")
    expect(result.svg).toContain("href=\"#mark\"")
    expect(result.svg).not.toContain("xlink:href")
    expect(result.svg).not.toContain("https://example.com")
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

  it("keeps SVG logos that compose artwork with local use references", async () => {
    const logo = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20">
        <defs><path id="bar" d="M2 8h16v4H2z" fill="#ffb13b"/></defs>
        <use xlink:href="#bar"/>
        <use xlink:href="#bar" transform="rotate(90 10 10)"/>
      </svg>
    `
    const result = await generate({
      logo,
      text: "Acme Labs",
      layout: "vertical",
      format: "svg",
    })

    expect(result.svg).toContain("<use")
    expect(result.svg).toContain("href=\"#bar\"")
    expect(result.svg).not.toContain("xlink:href")
    expect(result.svg).toContain("fill=\"#ffb13b\"")
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
