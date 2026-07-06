"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { X, Link2, Download, Check, MapPin, Accessibility } from "lucide-react"
import { Venue, Waypoint } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, floorLabel } from "@/lib/waypoint-meta"

interface Props {
  venue: Venue
  waypoint: Waypoint
  onClose: () => void
}

// The QR encodes a real positioning anchor (the venue's main entrance, or its
// centre if none is mapped) plus the destination, reusing the same
// `floor:<n>:lat:<x>:lng:<y>` format the camera QR-scanner already understands
// — scanning the poster both re-anchors your position and picks the destination.
function buildQrPayload(venue: Venue, waypoint: Waypoint): string {
  const anchor = venue.waypoints.find((w) => w.name === "Main Entrance") ?? null
  const anchorCoords = anchor?.coordinates ?? venue.center
  const anchorFloor = anchor?.floor ?? 0
  return `floor:${anchorFloor}:lat:${anchorCoords.lat}:lng:${anchorCoords.lng}:dest:${waypoint.id}`
}

function shareUrl(venue: Venue, waypoint: Waypoint): string {
  return `wayfinder.app/${venue.slug}/${waypoint.id}`
}

export default function ShareDialog({ venue, waypoint, onClose }: Props) {
  const [stepFree, setStepFree] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrThumb, setQrThumb] = useState<string | null>(null)
  const [showPoster, setShowPoster] = useState(false)

  const payload = buildQrPayload(venue, waypoint)
  const url = shareUrl(venue, waypoint)
  const anchorName = venue.waypoints.find((w) => w.name === "Main Entrance")?.name ?? venue.name

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(payload, { width: 128, margin: 1, color: { dark: "#0B1B2E", light: "#FFFFFF" } })
      .then((url) => { if (alive) setQrThumb(url) })
      .catch(() => {})
    return () => { alive = false }
  }, [payload])

  useEffect(() => {
    if (!showPoster) return
    const after = () => setShowPoster(false)
    window.addEventListener("afterprint", after)
    const t = setTimeout(() => window.print(), 150)
    return () => { clearTimeout(t); window.removeEventListener("afterprint", after) }
  }, [showPoster])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  const handleDownloadPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(payload, { width: 640, margin: 2 })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${waypoint.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`
      a.click()
    } catch {}
  }

  if (showPoster) {
    return (
      <Poster
        venue={venue}
        waypoint={waypoint}
        anchorName={anchorName}
        payload={payload}
        url={url}
        onClose={() => setShowPoster(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-0 shadow-[0_24px_60px_rgba(11,27,46,0.25)]">
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="font-display text-lg font-semibold text-wf-ink">Share this destination</h2>
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
            <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-[#E7F2FF] text-lg">
              {WAYPOINT_TYPE_ICONS[waypoint.type]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-wf-ink">{waypoint.name}</p>
              <p className="truncate text-xs text-wf-muted">{venue.name} · {floorLabel(waypoint.floor, venue.floorNaming)}</p>
            </div>
            {qrThumb && (
              <img src={qrThumb} alt="" className="h-16 w-16 flex-shrink-0 rounded-md border border-wf-border" />
            )}
          </div>

          <p className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-wf-faint">Link</p>
          <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-wf-border px-3.5 py-2.5">
            <Link2 size={16} className="flex-shrink-0 text-wf-faint" />
            <span className="flex-1 truncate text-sm text-wf-body">{url}</span>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                copied ? "bg-wf-teal-tint text-wf-teal-text" : "bg-wf-primary text-white"
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1"><Check size={13} /> Copied</span>
              ) : (
                "Copy"
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-wf-body">Link opens the step-free route</span>
            <button
              type="button"
              role="switch"
              aria-checked={stepFree}
              onClick={() => setStepFree((v) => !v)}
              className={`relative h-6 w-[42px] flex-shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
                stepFree ? "bg-wf-teal" : "bg-wf-border"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  stepFree ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              onClick={() => setShowPoster(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
            >
              <Download size={16} />
              Download poster (PDF)
            </button>
            <button
              onClick={handleDownloadPng}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-wf-border py-3 text-sm font-semibold text-wf-ink"
            >
              QR only (PNG)
            </button>
          </div>
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
      .then((url) => { if (alive) setQrLarge(url) })
      .catch(() => {})
    return () => { alive = false }
  }, [payload])

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 px-4 print:bg-white print:px-0">
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
              <MapPin size={15} className="text-white" />
            </span>
            <span className="font-display text-[17px] font-bold text-white">Wayfinder</span>
          </div>
          <span className="text-xs text-white/65">{venue.name}</span>
        </div>

        <div className="flex flex-1 flex-col items-center px-9 py-9 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-wf-primary">Scan to navigate to</p>
          <h2 className="mt-2 font-display text-[34px] font-bold -tracking-[0.8px] text-wf-ink">{waypoint.name}</h2>
          <div className="my-7 rounded-[20px] border-2 border-wf-border p-[18px]">
            {qrLarge ? <img src={qrLarge} alt={`QR code to ${waypoint.name}`} width={220} height={220} /> : <div className="h-[220px] w-[220px]" />}
          </div>
          <p className="max-w-[320px] text-[14.5px] text-wf-muted">
            Point your phone&apos;s camera at this code to open Wayfinder and get step-by-step directions from here.
          </p>
          {venue.accessibility?.stepFreeRoute && (
            <span className="mt-4 flex items-center gap-1.5 rounded-full bg-wf-teal-tint px-3 py-1.5 text-xs font-semibold text-wf-teal-text">
              <Accessibility size={13} />
              Step-free route available
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#EDF1F6] px-9 py-4.5">
          <span className="text-xs text-wf-faint">{url}</span>
          <span className="font-display text-[12.5px] font-semibold text-wf-ink">You are at: {anchorName}</span>
        </div>
      </div>
    </div>
  )
}
