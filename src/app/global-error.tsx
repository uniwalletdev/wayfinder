"use client"

// Fallback for a failure in the root layout itself. It replaces the layout, so
// it has to bring its own html/body and cannot rely on the app's fonts or
// stylesheet — plain, inline styles only, in the brand colours.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F8FC",
          color: "#0B1B2E",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 26, margin: "0 0 10px" }}>Findway couldn’t start</h1>
          <p style={{ color: "#51627A", lineHeight: 1.55, margin: "0 0 22px" }}>
            Something failed before the page could load.{error.digest ? ` Reference ${error.digest}.` : ""} Try again, or reload the page.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              font: "600 15px system-ui, sans-serif",
              color: "#fff",
              background: "#0A5DC2",
              border: 0,
              borderRadius: 14,
              padding: "13px 26px",
              boxShadow: "0 10px 24px rgba(10,93,194,.35)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
