"use client"

import { useEffect, useRef } from "react"

// Escape closes the overlay. Overlays can be opened from the keyboard ("/"
// focuses search on desktop), so each needs a keyboard way back out too — the
// close callback is kept in a ref so the listener never has to re-subscribe as
// parents re-render with fresh inline handlers.
export function useEscapeClose(onClose: () => void) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
