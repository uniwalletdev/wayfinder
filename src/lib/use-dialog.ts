"use client"

import { useEffect, useRef } from "react"
import { useEscapeClose } from "./use-escape"

// Focus management for the full-screen overlays (search, places, share, the
// mapping tools). Each one is a modal dialog in every sense but the markup:
// nothing behind it is reachable by touch, so nothing behind it should be
// reachable by keyboard either, and when it closes focus has to go back to
// whatever opened it — otherwise a keyboard or screen-reader user is dropped at
// the top of the document after every search.
//
// Returns a ref for the dialog's root element. On mount it moves focus to the
// first element marked data-autofocus (else the first focusable, else the root),
// keeps Tab cycling inside, and on unmount restores focus to the element that
// had it before. Escape closes, via the existing hook.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hidden && el.getClientRects().length > 0
  )
}

export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T | null>(null)
  useEscapeClose(onClose)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const opener = document.activeElement as HTMLElement | null

    // Let the overlay paint first: an element with autoFocus already has focus
    // by now, and we must not steal it from a text field the user is about to
    // type into.
    const raf = requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return
      const preferred = root.querySelector<HTMLElement>("[data-autofocus]")
      const target = preferred ?? focusables(root)[0] ?? root
      if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1")
      target.focus({ preventScroll: true })
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const list = focusables(root)
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener("keydown", onKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      root.removeEventListener("keydown", onKeyDown)
      // Only hand focus back if it is still inside the dialog (or was lost with
      // it); a user who has already clicked elsewhere keeps their place.
      const active = document.activeElement
      if (opener && opener.isConnected && (active === null || active === document.body || root.contains(active))) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  return ref
}
