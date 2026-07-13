"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import jsQR from "jsqr"
import { X, QrCode, Search, Compass, ArrowUp, RotateCw, CheckCircle2, MapPin, Sparkles } from "lucide-react"
import type { Coordinates, Route, RouteStep, Waypoint } from "@/lib/types"
import { distanceMeters, bearingBetween } from "@/lib/routing"
import { WAYPOINT_TYPE_ICONS } from "@/lib/waypoint-meta"
import { useEscapeClose } from "@/lib/use-escape"

// Live-mode AR navigation context. The camera view reads the same fused
// position, compass heading and route the map uses, and paints turn guidance on
// top of the video feed — the whole point of "Live camera", which previously
// showed only the raw camera.
interface LiveNav {
  position: Coordinates | null
  heading: number | null
  route: Route | null
  currentStep: RouteStep | null
  stepIndex: number
  destination: Waypoint | null
  // Open search to choose a destination (when live camera is opened before one
  // is picked), and hop to the QR scanner to re-fix an exact position.
  onPickDestination: () => void
  onScanQR: () => void
  // Present only when the device supports immersive AR and a route exists: lets
  // the user upgrade from the flat compass overlay to the floor-anchored view.
  onStartAr?: () => void
}

interface Props {
  mode: "qr" | "live"
  onQRDetected: (data: string) => void
  onClose: () => void
  // Present only in live mode; drives the AR guidance overlay.
  nav?: LiveNav
}

const WALK_SPEED_M_PER_MIN = 80

export default function CameraOverlay({ mode, onQRDetected, onClose, nav }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanInterval = useRef<NodeJS.Timeout | null>(null)
  const [detected, setDetected] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEscapeClose(onClose)

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      // Only QR mode needs to poll frames; live AR guidance is driven entirely
      // by position + heading props, so there's no per-frame work (or battery
      // drain) here.
      if (mode === "qr") {
        scanInterval.current = setInterval(scanForQR, 300)
      }
    } catch {
      setPermissionDenied(true)
    }
  }

  function stopCamera() {
    if (scanInterval.current) clearInterval(scanInterval.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  function scanForQR() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx || video.readyState < 2) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const qr = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })

    if (qr) {
      setDetected(true)
      if (scanInterval.current) clearInterval(scanInterval.current)
      setTimeout(() => {
        onQRDetected(qr.data)
        onClose()
      }, 600)
    }
  }

  useEffect(() => {
    // startCamera only flips state asynchronously (on a permission failure), so
    // this isn't a synchronous cascading render despite the lint heuristic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <span className="text-5xl mb-4">📷</span>
        <h2 className="text-xl font-bold mb-2">Camera access needed</h2>
        <p className="text-sm text-gray-300 mb-6">
          Allow camera access in your browser settings to use QR scanning and live camera navigation.
        </p>
        <button onClick={onClose} className="bg-[#005EB8] text-white px-6 py-3 rounded-xl font-semibold">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black">
      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-4 pt-safe-snug pb-4 flex items-center justify-between">
        <button onClick={onClose} className="text-white bg-black/40 rounded-full p-2">
          <X size={22} />
        </button>
        <p className="text-white font-semibold text-sm">
          {mode === "qr" ? "Scan QR Code" : "Live Camera Navigation"}
        </p>
        <div className="w-10" />
      </div>

      {mode === "qr" && <QRFinder detected={detected} />}

      {mode === "live" && nav && <LiveArOverlay nav={nav} onClose={onClose} />}
    </div>
  )
}

function QRFinder({ detected }: { detected: boolean }) {
  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#00BFFF] rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#00BFFF] rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#00BFFF] rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#00BFFF] rounded-br-xl" />
          {detected && (
            <div className="absolute inset-0 bg-green-500/30 rounded-2xl flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-8 pt-8 pb-safe-bar text-center">
        <p className="text-white text-sm">
          {detected ? "QR Code detected! Locating you..." : "Point camera at a QR code on the wall"}
        </p>
      </div>
    </>
  )
}

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`
  return `${(m / 1000).toFixed(1)}km`
}

// Shortest signed turn a→b in (-180, 180]. Positive = target is to the right of
// where the phone is pointing, negative = to the left.
function relativeAngle(target: number, heading: number): number {
  return ((((target - heading) % 360) + 540) % 360) - 180
}

function turnLabel(rel: number): string {
  const a = Math.abs(rel)
  if (a <= 20) return "Straight ahead"
  if (a >= 150) return "Turn around"
  const side = rel > 0 ? "right" : "left"
  if (a <= 75) return `Bear ${side}`
  return `Turn ${side}`
}

// The live camera turned into an AR walking guide. A big arrow rotates to point
// at the next waypoint relative to where the phone is aimed, with the live
// instruction, distance to the next turn and remaining ETA over the video.
function LiveArOverlay({ nav, onClose }: { nav: LiveNav; onClose: () => void }) {
  const { position, heading, route, currentStep, stepIndex, destination } = nav

  const guide = useMemo(() => {
    if (!route || !destination || !currentStep) return null

    const arrived = /arrived/i.test(currentStep.instruction) && stepIndex >= route.steps.length - 1

    // Point the arrow at the current step's waypoint if it has one, otherwise
    // straight at the destination.
    const target = currentStep.waypoint?.coordinates ?? destination.coordinates
    const distToNext = position ? distanceMeters(position, target) : currentStep.distance

    // Remaining distance = to the next turn plus every step still ahead.
    let remaining = distToNext
    for (let i = stepIndex + 1; i < route.steps.length; i++) remaining += route.steps[i].distance
    const eta = Math.max(1, Math.round(remaining / WALK_SPEED_M_PER_MIN))

    const bearingToTarget = position ? bearingBetween(position, target) : null
    const rel =
      bearingToTarget != null && heading != null ? relativeAngle(bearingToTarget, heading) : null

    return {
      arrived,
      isFloorChange: !!currentStep.floorChange,
      floorChange: currentStep.floorChange,
      instruction: currentStep.instruction,
      distToNext,
      remaining,
      eta,
      rel,
    }
  }, [route, destination, currentStep, stepIndex, position, heading])

  // No destination chosen yet — live camera can still be opened from the idle
  // sheet, so guide the user to pick somewhere rather than showing a bare feed.
  if (!guide) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <div className="bg-black/55 backdrop-blur-sm rounded-3xl px-6 py-7 max-w-xs">
          <Compass size={40} className="text-[#00BFFF] mx-auto mb-3" />
          <h2 className="text-white text-lg font-bold mb-1.5">Point the way with live camera</h2>
          <p className="text-gray-200 text-sm mb-5">
            Choose where you&apos;re going and an arrow will appear over the camera, guiding you turn by turn.
          </p>
          <button
            onClick={nav.onPickDestination}
            className="w-full flex items-center justify-center gap-2 bg-[#009639] text-white rounded-xl py-3 font-bold"
          >
            <Search size={18} />
            Choose destination
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Instruction banner */}
      <div className="absolute top-16 left-0 right-0 px-4 flex justify-center">
        <div className="bg-[#005EB8] text-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2.5 max-w-sm w-full">
          <span className="text-2xl flex-shrink-0">
            {destination ? WAYPOINT_TYPE_ICONS[destination.type] : "📍"}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{guide.instruction}</p>
            {!guide.arrived && (
              <p className="text-white/80 text-xs">{fmtDistance(guide.distToNext)} away</p>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade to floor-anchored immersive AR, when the device supports it. */}
      {nav.onStartAr && (
        <div className="absolute top-32 left-0 right-0 px-4 flex justify-center">
          <button
            onClick={nav.onStartAr}
            className="flex items-center gap-2 bg-white/90 text-[#005EB8] rounded-full pl-3 pr-4 py-1.5 text-xs font-bold shadow-lg"
          >
            <Sparkles size={14} />
            Try immersive AR
          </button>
        </div>
      )}

      {/* Centre: the AR cue */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {guide.arrived ? (
          <div className="flex flex-col items-center">
            <CheckCircle2 size={96} className="text-[#009639] drop-shadow-lg" strokeWidth={2.5} />
            <p className="text-white font-bold text-lg mt-3 drop-shadow">You&apos;ve arrived</p>
          </div>
        ) : guide.isFloorChange ? (
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-[#005EB8]/85 flex items-center justify-center shadow-2xl border-4 border-white/70">
              <span className="text-6xl">{guide.floorChange?.via === "stairs" ? "🪜" : "🛗"}</span>
            </div>
            <p className="text-white font-bold text-base mt-3 drop-shadow text-center px-6">
              Take the {guide.floorChange?.via} to Floor {guide.floorChange?.to}
            </p>
          </div>
        ) : guide.rel == null ? (
          // No compass fix yet — can't orient the arrow, so ask for a calibration wave.
          <div className="flex flex-col items-center px-8 text-center">
            <RotateCw size={72} className="text-[#00BFFF] animate-spin drop-shadow" style={{ animationDuration: "3s" }} />
            <p className="text-white font-semibold text-sm mt-4 drop-shadow max-w-[15rem]">
              Hold your phone upright and move it in a figure-8 to find the compass
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div
              className="transition-transform duration-300 ease-out will-change-transform"
              style={{ transform: `rotate(${guide.rel}deg)` }}
            >
              <div className="w-40 h-40 rounded-full bg-[#005EB8]/80 flex items-center justify-center shadow-2xl border-4 border-white/70">
                <ArrowUp size={92} className="text-white" strokeWidth={3} />
              </div>
            </div>
            <p className="text-white font-extrabold text-xl mt-4 drop-shadow-lg">{turnLabel(guide.rel)}</p>
          </div>
        )}
      </div>

      {/* Bottom HUD: remaining distance + ETA + quick actions */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-safe-bar">
        <div className="flex items-center justify-center gap-6 mb-3">
          <div className="text-center">
            <p className="text-white text-lg font-bold leading-none">{guide.eta} min</p>
            <p className="text-gray-300 text-[11px] mt-0.5">arrival</p>
          </div>
          <div className="w-px h-8 bg-white/25" />
          <div className="text-center">
            <p className="text-white text-lg font-bold leading-none">{fmtDistance(guide.remaining)}</p>
            <p className="text-gray-300 text-[11px] mt-0.5">to destination</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={nav.onScanQR}
            className="flex-1 flex items-center justify-center gap-2 bg-white/15 backdrop-blur text-white rounded-xl py-2.5 text-sm font-semibold"
          >
            <QrCode size={16} />
            Scan to locate me
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-[#005EB8] rounded-xl py-2.5 text-sm font-semibold"
          >
            <MapPin size={16} />
            Back to map
          </button>
        </div>
      </div>
    </>
  )
}
