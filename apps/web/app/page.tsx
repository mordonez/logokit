import { listLayouts, renderSvg } from "@mordonezdev/logokit-core"

import { GeneratorShell } from "../components/generator-shell"

export default async function HomePage() {
  const layouts = listLayouts()
  const initialPreview = await renderSvg({
    text: "Acme Labs",
    secondaryText: "Research Studio",
    layout: "horizontal",
    format: "svg",
  })

  return <GeneratorShell layouts={layouts} initialPreviewSvg={initialPreview.svg} />
}
