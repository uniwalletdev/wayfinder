"use client"

import { ReactNode, useId } from "react"
import { X, ArrowLeft } from "lucide-react"
import { useDialog } from "@/lib/use-dialog"

// The chrome every full-screen overlay shares: a white header with a close (or
// back) control and a Space Grotesk title, over a scrolling body. One component
// so search, places, plan upload and the rest look like the same product as
// the panel they open from — they used to carry the pre-redesign NHS-blue bar.
//
// Also where the dialog semantics live: role, aria-modal, a labelled heading,
// focus trap and focus restore (useDialog). Callers only supply content.

interface Props {
  title?: string
  // Replaces the title in the header's middle slot, e.g. a search field.
  header?: ReactNode
  // Right-hand header slot, e.g. an action button.
  headerEnd?: ReactNode
  onClose: () => void
  // "close" shows an X; "back" an arrow, for a step inside a flow.
  dismiss?: "close" | "back"
  dismissLabel?: string
  // Stacking context: overlays opened from the panel sit at 200, the camera
  // tools at 300 (they cover everything, including each other).
  z?: 200 | 300
  // Pass a heading id when the visible title lives in `header` instead.
  labelledBy?: string
  className?: string
  children: ReactNode
}

export default function Overlay({
  title,
  header,
  headerEnd,
  onClose,
  dismiss = "close",
  dismissLabel,
  z = 200,
  labelledBy,
  className = "",
  children,
}: Props) {
  const ref = useDialog<HTMLDivElement>(onClose)
  const titleId = useId()
  const label = dismissLabel ?? (dismiss === "back" ? "Back" : "Close")
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : labelledBy}
      className={`fixed inset-0 flex flex-col bg-white ${z === 300 ? "z-[300]" : "z-[200]"} ${className}`}
    >
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-wf-border-faint bg-white px-4 pb-3 pt-safe-snug lg:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={label}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-wf-surface text-wf-ink transition-colors hover:bg-wf-border"
        >
          {dismiss === "back" ? <ArrowLeft size={18} /> : <X size={18} />}
        </button>
        {header ? (
          <div className="min-w-0 flex-1">{header}</div>
        ) : (
          <h2 id={titleId} className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-wf-ink">
            {title}
          </h2>
        )}
        {headerEnd}
      </div>
      {children}
    </div>
  )
}
