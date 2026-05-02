#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"

import { Command } from "commander"

import { generate, listLayouts, type LayoutDescriptor } from "@mordonezdev/logokit-core"
import { version as cliVersion } from "../package.json"

interface GenerateOptions {
  logo?: string
  text?: string
  secondary?: string
  layout?: "horizontal" | "vertical" | "stacked"
  variant?: "color" | "mono-black" | "mono-white"
  background?: string
  format?: "svg" | "png"
  out?: string
  outDir?: string
  config?: string
  json?: boolean
  quiet?: boolean
  font?: string
  secondaryFont?: string
}

async function readLogo(logoPath?: string) {
  if (!logoPath) {
    return { logo: undefined, logoMimeType: undefined }
  }

  const extension = path.extname(logoPath).toLowerCase()
  const file = await readFile(logoPath)
  if (extension === ".svg") {
    return { logo: file.toString("utf8"), logoMimeType: "image/svg+xml" }
  }

  if (extension === ".png") {
    return { logo: file, logoMimeType: "image/png" }
  }

  throw new Error("Only SVG and PNG logo files are supported.")
}

function parseSimpleCsv(source: string) {
  const [headerLine, ...rows] = source.trim().split(/\r?\n/)
  const headers = headerLine.split(",").map((column) => column.trim())

  return rows.filter(Boolean).map((row) => {
    const cells = row.split(",")
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = (cells[index] ?? "").trim()
      return record
    }, {})
  })
}

async function loadConfig(configPath?: string) {
  if (!configPath) {
    return {}
  }

  const raw = await readFile(configPath, "utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

async function runGenerate(options: GenerateOptions) {
  const config = await loadConfig(options.config)
  const merged = { ...config, ...options } as GenerateOptions
  if (!merged.text) {
    throw new Error("--text is required unless it is provided in --config.")
  }

  const logoInput = await readLogo(merged.logo)
  const result = await generate({
    text: merged.text,
    secondaryText: merged.secondary,
    layout: merged.layout,
    variant: merged.variant,
    background: merged.background,
    format: merged.format,
    primaryFont: merged.font,
    secondaryFont: merged.secondaryFont,
    ...logoInput,
  })

  if (merged.out) {
    await mkdir(path.dirname(merged.out), { recursive: true })
    await writeFile(merged.out, result.buffer)
  } else if (!merged.json) {
    process.stdout.write(result.buffer)
  }

  if (merged.json) {
    const targetPath = merged.out ?? null
    process.stdout.write(`${JSON.stringify({
      path: targetPath,
      filename: result.filename,
      format: result.format,
      sha256: result.hash,
      width: result.width,
      height: result.height,
    }, null, 2)}\n`)
  } else if (!merged.quiet && merged.out) {
    process.stderr.write(`Wrote ${merged.out}\n`)
  }
}

async function runBatch(inputPath: string, options: GenerateOptions & { manifest?: boolean }) {
  const input = await readFile(inputPath, "utf8")
  const items = inputPath.endsWith(".json") ? JSON.parse(input) : parseSimpleCsv(input)
  const outDir = options.outDir
  if (!outDir) {
    throw new Error("batch requires --out-dir.")
  }

  await mkdir(outDir, { recursive: true })
  const manifest: Array<Record<string, unknown>> = []
  for (const item of items) {
    const current = { ...options, ...item } as GenerateOptions
    const stem = String(current.text ?? "lockup").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const extension = current.format === "png" ? "png" : "svg"
    const outFile = path.join(outDir, `${stem}.${extension}`)
    await runGenerate({ ...current, out: outFile, quiet: true })
    manifest.push({ text: current.text, outFile, format: current.format ?? "svg" })
  }

  if (options.manifest) {
    await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2))
  }

  process.stderr.write(`Generated ${manifest.length} assets in ${outDir}\n`)
}

const program = new Command()
program.name("logokit")
program.description("Generate brand lockups from any logo.")
program.version(`${cliVersion} (core ${cliVersion}, node ${process.version})`)
program
  .option("-l, --logo <path>", "Path to an SVG or PNG logo")
  .option("-t, --text <text>", "Primary text")
  .option("-s, --secondary <text>", "Secondary text")
  .option("--font <family>", "Primary font family (bundled: Inter, DM Sans, Outfit, Geist, Plus Jakarta Sans; or any Google Fonts name)")
  .option("--secondary-font <family>", "Secondary font family (same options as --font)")
  .option("-L, --layout <name>", "horizontal | vertical | stacked", "horizontal")
  .option("-v, --variant <name>", "color | mono-black | mono-white", "color")
  .option("-b, --background <color>", "transparent or #RRGGBB", "transparent")
  .option("-f, --format <format>", "svg | png", "svg")
  .option("-o, --out <path>", "Output file path")
  .option("--config <path>", "Read options from a JSON file")
  .option("--json", "Print output metadata as JSON")
  .option("--quiet", "Suppress non-essential stderr output")
  .action(async (options) => {
    await runGenerate(options as GenerateOptions)
  })

program
  .command("batch")
  .argument("<input>", "CSV or JSON file")
  .option("-O, --out-dir <path>", "Output directory")
  .option("--manifest", "Emit manifest.json")
  .allowUnknownOption(false)
  .action(async (input, options) => {
    await runBatch(input, options)
  })

program
  .command("init")
  .description("Create a starter logokit.config.json file")
  .action(async () => {
    const target = path.join(process.cwd(), "logokit.config.json")
    const content = {
      text: "Acme Labs",
      secondary: "Research Studio",
      layout: "horizontal",
      variant: "color",
      background: "transparent",
      format: "svg",
    }
    await writeFile(target, JSON.stringify(content, null, 2))
    process.stderr.write(`Created ${target}\n`)
  })

program
  .command("layouts")
  .description("List the available layouts")
  .action(() => {
    for (const layout of listLayouts() as LayoutDescriptor[]) {
      process.stdout.write(`${layout.name}\t${layout.description}\n`)
    }
  })

program
  .command("doctor")
  .description("Check the local runtime")
  .action(async () => {
    const probe = await generate({ text: "Doctor", format: "svg" })
    process.stdout.write(`${JSON.stringify({
      node: process.version,
      tmpdir: os.tmpdir(),
      layouts: listLayouts().map((layout) => layout.name),
      probeHash: probe.hash,
    }, null, 2)}\n`)
  })

program.parseAsync(process.argv).catch((error: Error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
