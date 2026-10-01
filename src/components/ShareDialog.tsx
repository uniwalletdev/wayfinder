"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { X, Link2, Download, Check, MapPin, Accessibility, Share2 } from "lucide-react"
import { Venue, Waypoint } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, floorLabel } from "@/lib/waypoint-meta"
import { buildNavigateUrl, displayUrl } from "@/lib/share-link"
import { useDialog } from "@/lib/use-dialog"
import Toggle from "@/components/Toggle"
import { toast } from "@/components/Toast"
import { publicOrigin } from "@/lib/app-shell"

interface Props {
  venue: Venue
  waypoint: Waypoint
  onClose: () => void
}

// The QR code and the link are both real URLs on this deployment (see
// share-link.ts). The poster's code additionally carries a positioning anchor —
// the venue's main entrance, or its centre if none is mapped — so scanning it
// with any phone camera opens the app, places the walker at the entrance it is
// posted at, and starts guidance to the destination it advertises. The plain
// link leaves the anchor out: a link opened at home should not pretend the
// reader is standing in the lobby.
function posterAnchor(venue: Venue): { name: string; floor: number; lat: number; lng: number } {
  const entrance = venue.waypoints.find((w) => w.name === "Main Entrance") ?? null
  const c = entrance?.coordinates ?? venue.center
  return { name: entrance?.name ?? venue.name, floor: entrance?.floor ?? 0, lat: c.lat, lng: c.lng }
}

export default function ShareDialog({ venue, waypoint, onClose }: Props) {
  const [stepFree, setStepFree] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrThumb, setQrThumb] = useState<string | null>(null)
  const [showPoster, setShowPoster] = useState(false)
  // The deployment's own origin, read in the browser. Empty during the first
  // paint; the link and QR fill in as soon as it is known.
  const [origin, setOrigin] = useState("")
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    // Browser facts, unknown during server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(publicOrigin())
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  // Escape steps back like the X buttons do: poster first, then the dialog.
  const dialogRef = useDialog<HTMLDivElement>(() => (showPoster ? setShowPoster(false) : onClose()))

  const anchor = posterAnchor(venue)
  const link = { venueId: venue.id, destinationId: waypoint.id, stepFree }
  const url = origin ? buildNavigateUrl(origin, link) : ""
  const posterUrl = origin ? buildNavigateUrl(origin, { ...link, anchor }) : ""
  const shown = url ? displayUrl(url) : "…"

  useEffect(() => {
    if (!posterUrl) return
    let alive = true
    QRCode.toDataURL(posterUrl, { width: 128, margin: 1, color: { dark: "#0B1B2E", light: "#FFFFFF" } })
      .then((data) => { if (alive) setQrThumb(data) })
      .catch(() => {})
    return () => { alive = false }
  }, [posterUrl])

  useEffect(() => {
    if (!showPoster) return
    const after = () => setShowPoster(false)
    window.addEventListener("afterprint", after)
    const t = setTimeout(() => window.print(), 150)
    return () => { clearTimeout(t); window.removeEventListener("afterprint", after) }
  }, [showPoster])

  const handleCopy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Couldn’t copy the link", "Select the address and copy it by hand.")
    }
  }

  const handleShare = async () => {
    if (!url) return
    try {
      await navigator.share({ title: `${waypoint.name} — ${venue.name}`, text: `Directions to ${waypoint.name} at ${venue.name}`, url })
    } catch {
      // The share sheet was dismissed, or the platform refused. Nothing to say.
    }
  }

  const handleDownloadPng = async () => {
    if (!posterUrl) return
    try {
      const dataUrl = await QRCode.toDataURL(posterUrl, { width: 640, margin: 2 })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${waypoint.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`
      a.click()
    } catch {
      toast.error("Couldn’t create the QR image")
    }
  }

  if (showPoster) {
    return (
      <Poster
        venue={venue}
        waypoint={waypoint}
        anchorName={anchor.name}
        payload={posterUrl}
        url={shown}
        onClose={() => setShowPoster(false)}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="w-full max-w-[420px] rounded-[20px] bg-white p-0 shadow-[0_24px_60px_rgba(11,27,46,0.25)]"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 id="share-dialog-title" className="font-display text-lg font-semibold text-wf-ink">Share this destination</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-wf-surface text-wf-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center gap-3 rounded-[14px] bg-wf-surface px-3.5 py-3">
            <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-[#E7F2FF] text-lg" aria-hidden="true">
              {WAYPOINT_TYPE_ICONS[waypoint.type]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-wf-ink">{waypoint.name}</p>
              <p className="truncate text-xs text-wf-muted">{venue.name} · {floorLabel(waypoint.floor, venue.floorNaming)}</p>
            </div>
            {qrThumb && (
              // A generated data: URL — next/image has nothing to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrThumb} alt="" className="h-16 w-16 flex-shrink-0 rounded-md border border-wf-border" />
            )}
          </div>

          <p className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-wf-muted">Link</p>
          <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-wf-border px-3.5 py-2.5">
            <Link2 size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
            <span className="flex-1 truncate text-sm text-wf-body" title={url}>{shown}</span>
            <button
              onClick={handleCopy}
              disabled={!url}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                copied ? "bg-wf-teal-tint text-wf-teal-text" : "bg-wf-primary text-white"
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1"><Check size={13} aria-hidden="true" /> Copied</span>
              ) : (
                "Copy"
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-wf-body">Link opens the step-free route</span>
            <Toggle on={stepFree} onChange={setStepFree} aria-label="Link opens the step-free route" />
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {canShare && (
              <button
                onClick={handleShare}
                disabled={!url}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] disabled:opacity-50"
              >
                <Share2 size={16} aria-hidden="true" />
                Share…
              </button>
            )}
            <button
              onClick={() => setShowPoster(true)}
              disabled={!posterUrl}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-50 ${
                canShare ? "border border-wf-border text-wf-ink" : "bg-wf-primary text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
              }`}
            >
              <Download size={16} aria-hidden="true" />
              Print poster (PDF)
            </button>
            <button
              onClick={handleDownloadPng}
              disabled={!posterUrl}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-wf-border py-3 text-sm font-semibold text-wf-ink disabled:opacity-50"
            >
              QR only (PNG)
            </button>
          </div>
          <p className="mt-3 text-center text-[11.5px] leading-snug text-wf-muted">
            The poster’s code also places whoever scans it at {anchor.name}, so directions start from where it’s posted.
          </p>
        </div>
      </div>
    </div>
  )
}

function Poster({
  venue,
  waypoint,
  anchorName,
  payload,
  url,
  onClose,
}: {
  venue: Venue
  waypoint: Waypoint
  anchorName: string
  payload: string
  url: string
  onClose: () => void
}) {
  const [qrLarge, setQrLarge] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(payload, { width: 320, margin: 1, color: { dark: "#0B1B2E", light: "#FFFFFF" } })
      .then((data) => { if (alive) setQrLarge(data) })
      .catch(() => {})
    return () => { alive = false }
  }, [payload])

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 px-4 print:bg-white print:px-0"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="wf-poster-print flex w-full max-w-[480px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(11,27,46,0.25)]">
        <div className="flex items-center justify-between bg-wf-ink px-9 py-[26px] print:hidden">
          <button
            onClick={onClose}
            aria-label="Close poster"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X size={16} />
          </button>
          <span className="text-xs text-white/65">{venue.name}</span>
        </div>
        <div className="hidden items-center justify-between bg-wf-ink px-9 py-[26px] print:flex">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
              <MapPin size={15} className="text-white" aria-hidden="true" />
            </span>
            <span className="font-display text-[17px] font-bold text-white">Findway</span>
          </div>
          <span className="text-xs text-white/65">{venue.name}</span>
        </div>

        <div className="flex flex-1 flex-col items-center px-9 py-9 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-wf-primary">Scan to navigate to</p>
          <h2 className="mt-2 font-display text-[34px] font-bold -tracking-[0.8px] text-wf-ink">{waypoint.name}</h2>
          <div className="my-7 rounded-[20px] border-2 border-wf-border p-[18px]">
            {/* A generated data: URL — next/image has nothing to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrLarge ? <img src={qrLarge} alt={`QR code to ${waypoint.name}`} width={220} height={220} /> : <div className="h-[220px] w-[220px]" />}
          </div>
          <p className="max-w-[320px] text-[14.5px] text-wf-muted">
            Point your phone’s camera at this code to open Findway and get step-by-step directions from here.
          </p>
          {venue.accessibility?.stepFreeRoute && (
            <span className="mt-4 flex items-center gap-1.5 rounded-full bg-wf-teal-tint px-3 py-1.5 text-xs font-semibold text-wf-teal-text">
              <Accessibility size={13} aria-hidden="true" />
              Step-free route available
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[#EDF1F6] px-9 py-4.5">
          <span className="min-w-0 truncate text-xs text-wf-faint">{url}</span>
          <span className="flex-shrink-0 font-display text-[12.5px] font-semibold text-wf-ink">You are at: {anchorName}</span>
        </div>
      </div>
    </div>
  )
}
