import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

const packageRoot = path.resolve(import.meta.dirname, "..")
const cliEntry = path.join(packageRoot, "dist", "index.js")
const fixture = path.resolve(packageRoot, "..", "..", "apps", "web", "tests", "fixtures", "sample-logo.svg")

function runCli(args: string[]) {
  return execFileSync("node", [cliEntry, ...args], { cwd: packageRoot }).toString()
}

describe("logokit cli", () => {
  it("lists layouts", () => {
    const output = runCli(["layouts"])
    expect(output).toContain("horizontal")
    expect(output).toContain("vertical")
    expect(output).toContain("stacked")
  })

  it("writes an svg asset", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "logokit-cli-"))
    const outFile = path.join(tempDir, "lockup.svg")
    runCli(["--logo", fixture, "--text", "Acme Labs", "--out", outFile])

    const svg = readFileSync(outFile, "utf8")
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("<path")
  })
})
