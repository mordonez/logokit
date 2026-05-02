import Link from "next/link"

export default function NotFoundPage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">404</span>
        <h1>This page does not exist.</h1>
        <p>The workspace only exposes the main editor and the API routes.</p>
        <div style={{ marginTop: 24 }}>
          <Link className="button-secondary" href="/">Back to the editor</Link>
        </div>
      </section>
    </main>
  )
}
