"use client"

import { useEffect } from "react"

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Application error</span>
        <h1>Something broke while rendering the workspace.</h1>
        <p>Reset the page to retry. If the problem persists, inspect the server logs or the failed network response.</p>
        <div style={{ marginTop: 24 }}>
          <button className="button" onClick={reset}>Retry</button>
        </div>
      </section>
    </main>
  )
}
