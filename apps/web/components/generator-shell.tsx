"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"

const BUNDLED_FONTS = ["Inter", "Plus Jakarta Sans", "DM Sans", "Outfit", "Geist"] as const
type BundledFont = (typeof BUNDLED_FONTS)[number]

export interface LayoutCard {
  name: "horizontal" | "vertical" | "stacked"
  label: string
  description: string
  previewSvg: string
}

interface GeneratorShellProps {
  layouts: LayoutCard[]
  initialPreviewSvg: string
  bundledFonts: readonly string[]
}

interface PreviewState {
  url: string
}

const maxSvgBytes = 2_000_000
const maxPngBytes = 5_000_000

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function readLogoFile(file: File) {
  if (file.type === "image/svg+xml") {
    if (file.size > maxSvgBytes) {
      throw new Error("SVG uploads are limited to 2 MB.")
    }

    return {
      data: await file.text(),
      mimeType: file.type,
      name: file.name,
    }
  }

  if (file.type !== "image/png") {
    throw new Error("Only SVG and PNG logos are supported.")
  }

  if (file.size > maxPngBytes) {
    throw new Error("PNG uploads are limited to 5 MB.")
  }

  return {
    data: await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("Unable to read uploaded file."))
      reader.readAsDataURL(file)
    }),
    mimeType: file.type,
    name: file.name,
  }
}

export function GeneratorShell({ layouts, initialPreviewSvg, bundledFonts }: GeneratorShellProps) {
  const [text, setText] = useState("Acme Labs")
  const [secondaryText, setSecondaryText] = useState("Research Studio")
  const [layout, setLayout] = useState<LayoutCard["name"]>("horizontal")
  const [variant, setVariant] = useState<"color" | "mono-black" | "mono-white">("color")
  const [backgroundMode, setBackgroundMode] = useState<"transparent" | "solid">("transparent")
  const [background, setBackground] = useState("#10213A")
  const [primaryFont, setPrimaryFont] = useState<string>("Inter")
  const [secondaryFont, setSecondaryFont] = useState<string>("Inter")
  const [customPrimaryFont, setCustomPrimaryFont] = useState("")
  const [customSecondaryFont, setCustomSecondaryFont] = useState("")
  // committedXFont is what's actually sent to the API — only updates on blur/Enter
  const [committedPrimaryFont, setCommittedPrimaryFont] = useState("Inter")
  const [committedSecondaryFont, setCommittedSecondaryFont] = useState("Inter")
  const [preview, setPreview] = useState<PreviewState | null>({
    url: svgToDataUrl(initialPreviewSvg),
  })
  const [pending, setPending] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")
  const [logoPayload, setLogoPayload] = useState<{ data: string; mimeType: string; name: string } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const previewInput = useMemo(
    () => ({
      text,
      secondaryText,
      layout,
      variant,
      background: backgroundMode === "solid" ? background : "transparent",
      logo: logoPayload?.data,
      logoMimeType: logoPayload?.mimeType,
      primaryFont: committedPrimaryFont,
      secondaryFont: committedSecondaryFont,
    }),
    [background, backgroundMode, committedPrimaryFont, committedSecondaryFont, layout, logoPayload, secondaryText, text, variant],
  )

  function commitPrimaryFont() {
    const resolved = customPrimaryFont.trim() || primaryFont
    if (resolved !== "__custom__") setCommittedPrimaryFont(resolved)
  }

  function commitSecondaryFont() {
    const resolved = customSecondaryFont.trim() || secondaryFont
    if (resolved !== "__custom__") setCommittedSecondaryFont(resolved)
  }

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...previewInput, format: "svg" }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const failure = await response.json().catch(() => ({ error: "Preview failed." }))
          throw new Error(failure.error ?? "Preview failed.")
        }

        const svg = await response.text()
        startTransition(() => {
          setPreview((current) => {
            if (current && current.url.startsWith("blob:")) {
              URL.revokeObjectURL(current.url)
            }

            const blob = new Blob([svg], { type: "image/svg+xml" })
            return { url: URL.createObjectURL(blob) }
          })
          setError("")
        })
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError(requestError instanceof Error ? requestError.message : "Preview failed.")
        }
      } finally {
        setPending(false)
      }
    }, 150)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [previewInput])

  useEffect(() => {
    return () => {
      if (preview && preview.url.startsWith("blob:")) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [preview])

  async function handleFile(file: File) {
    try {
      const logo = await readLogoFile(file)
      setLogoPayload(logo)
      setError("")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.")
    }
  }

  async function handleDownload(format: "svg" | "png") {
    if (downloading) return
    setDownloading(true)
    try {
      setDownloadStatus(`Preparing ${format.toUpperCase()}…`)
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...previewInput, format }),
      })

      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: "Download failed." }))
        throw new Error(failure.error ?? "Download failed.")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${text.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "lockup"}-${layout}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setDownloadStatus(`${format.toUpperCase()} ready.`)
    } catch (downloadError) {
      setDownloadStatus("")
      setError(downloadError instanceof Error ? downloadError.message : "Download failed.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">logokit</span>
          <span className="brand-tagline">Brand lockup generator</span>
        </div>
        <nav className="topbar-links" aria-label="Project links">
          <a href="/api/openapi.json" target="_blank" rel="noreferrer">API</a>
          <a href="https://github.com/mordonez/logokit" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      <div className="workspace">
        <section className="panel preview-panel" aria-live="polite">
          <div className="preview-toolbar">
            <div className="preview-title">
              <span>Preview</span>
              <span className="status">{pending ? "Rendering…" : "Ready"}</span>
            </div>
            <span className="file-pill" title={logoPayload?.name ?? "Default mark"}>
              {logoPayload?.name ?? "Default mark"}
            </span>
          </div>
          <div className="preview-stage">
            {preview ? <img src={preview.url} alt="Generated logo preview" /> : null}
          </div>
          {error ? <div className="error-box">{error}</div> : null}
          <div className="download-row">
            <span className="helper" aria-live="polite">
              {downloadStatus || "SVG keeps vectors. PNG renders at 2×."}
            </span>
            <div className="download-actions">
              <button className="button-secondary" onClick={() => handleDownload("png")} disabled={downloading}>PNG</button>
              <button className="button" onClick={() => handleDownload("svg")} disabled={downloading}>Download SVG</button>
            </div>
          </div>
        </section>

        <aside className="panel form-panel">
          <section className="form-section">
            <h2>Content</h2>
            <div className="field">
              <label htmlFor="primary-text">Primary text</label>
              <input
                id="primary-text"
                className="text-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={96}
              />
            </div>
            <div className="field">
              <label htmlFor="secondary-text">Secondary text</label>
              <input
                id="secondary-text"
                className="text-input"
                value={secondaryText}
                onChange={(event) => setSecondaryText(event.target.value)}
                maxLength={96}
                placeholder="Optional"
              />
            </div>
          </section>

          <section className="form-section">
            <h2>Logo</h2>
            <div
              className={`dropzone${dragActive ? " active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault()
                setDragActive(false)
              }}
              onDrop={async (event) => {
                event.preventDefault()
                setDragActive(false)
                const file = event.dataTransfer.files.item(0)
                if (file) {
                  await handleFile(file)
                }
              }}
            >
              <span className="helper">
                {logoPayload ? logoPayload.name : "Drop SVG / PNG, or"}
              </span>
              <div className="file-actions">
                <label className="button-secondary">
                  {logoPayload ? "Replace" : "Choose file"}
                  <input
                    type="file"
                    accept="image/svg+xml,image/png"
                    hidden
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        await handleFile(file)
                      }
                    }}
                  />
                </label>
                {logoPayload ? (
                  <button className="button-ghost" onClick={() => setLogoPayload(null)}>Reset</button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Layout</h2>
            <div className="layout-grid">
              {layouts.map((item) => (
                <label key={item.name} className={`layout-option${item.name === layout ? " selected" : ""}`}>
                  <img src={svgToDataUrl(item.previewSvg)} alt="" aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <input
                    type="radio"
                    name="layout"
                    checked={layout === item.name}
                    onChange={() => setLayout(item.name)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="form-section">
            <h2>Fonts</h2>
            <div className="field">
              <label htmlFor="primary-font">Primary font</label>
              <select
                id="primary-font"
                className="select-input"
                value={primaryFont}
                onChange={(e) => {
                  const val = e.target.value
                  setPrimaryFont(val)
                  setCustomPrimaryFont("")
                  if (val !== "__custom__") setCommittedPrimaryFont(val)
                }}
              >
                {bundledFonts.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Custom (Google Fonts)…</option>
              </select>
              {primaryFont === "__custom__" && (
                <>
                  <input
                    className="text-input"
                    style={{ marginTop: 4 }}
                    placeholder="e.g. Raleway — press Enter to apply"
                    value={customPrimaryFont}
                    onChange={(e) => setCustomPrimaryFont(e.target.value)}
                    onBlur={commitPrimaryFont}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitPrimaryFont() } }}
                  />
                  <a className="helper" href="https://fonts.google.com" target="_blank" rel="noreferrer" style={{ marginTop: 2 }}>Browse Google Fonts ↗</a>
                </>
              )}
            </div>
            <div className="field">
              <label htmlFor="secondary-font">Secondary font</label>
              <select
                id="secondary-font"
                className="select-input"
                value={secondaryFont}
                onChange={(e) => {
                  const val = e.target.value
                  setSecondaryFont(val)
                  setCustomSecondaryFont("")
                  if (val !== "__custom__") setCommittedSecondaryFont(val)
                }}
              >
                {bundledFonts.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Custom (Google Fonts)…</option>
              </select>
              {secondaryFont === "__custom__" && (
                <>
                  <input
                    className="text-input"
                    style={{ marginTop: 4 }}
                    placeholder="e.g. Raleway — press Enter to apply"
                    value={customSecondaryFont}
                    onChange={(e) => setCustomSecondaryFont(e.target.value)}
                    onBlur={commitSecondaryFont}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSecondaryFont() } }}
                  />
                  <a className="helper" href="https://fonts.google.com" target="_blank" rel="noreferrer" style={{ marginTop: 2 }}>Browse Google Fonts ↗</a>
                </>
              )}
            </div>
          </section>

          <section className="form-section">
            <h2>Appearance</h2>
            <div className="field">
              <span className="group-label">Variant</span>
              <div className="inline-row">
                {[
                  { id: "color", label: "Color" },
                  { id: "mono-black", label: "Black" },
                  { id: "mono-white", label: "White" },
                ].map((choice) => (
                  <label key={choice.id} className={`choice${variant === choice.id ? " selected" : ""}`}>
                    <input
                      type="radio"
                      name="variant"
                      checked={variant === choice.id}
                      onChange={() => setVariant(choice.id as typeof variant)}
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="appearance-grid" style={{ marginTop: 8 }}>
              <div className="field">
                <span className="group-label">Background</span>
                <div className="inline-row">
                  <label className={`choice${backgroundMode === "transparent" ? " selected" : ""}`}>
                    <input
                      type="radio"
                      name="background-mode"
                      checked={backgroundMode === "transparent"}
                      onChange={() => setBackgroundMode("transparent")}
                    />
                    Transparent
                  </label>
                  <label className={`choice${backgroundMode === "solid" ? " selected" : ""}`}>
                    <input
                      type="radio"
                      name="background-mode"
                      checked={backgroundMode === "solid"}
                      onChange={() => setBackgroundMode("solid")}
                    />
                    Solid
                  </label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="background-color" className="group-label">Color</label>
                <input
                  id="background-color"
                  className="color-input"
                  type="color"
                  value={background}
                  disabled={backgroundMode !== "solid"}
                  onChange={(event) => setBackground(event.target.value)}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="footnote">
        <span>Same engine via <code className="inline">POST /api/generate</code> and <code className="inline">npx @mordonezdev/logokit</code>.</span>
        <span>Built by <a href="https://github.com/mordonez/" target="_blank" rel="noreferrer">Miguel Ordóñez</a>.</span>
      </footer>
    </main>
  )
}
