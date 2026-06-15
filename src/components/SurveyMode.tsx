"use client"

import { useEffect, useRef, useState } from "react"
import { SurveyFrame, Coordinates, Waypoint, SurveyTrail } from "@/lib/types"
import { WaypointType } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorShortLabel } from "@/lib/waypoint-meta"
import { X, Square, MapPin, Check, ChevronUp, ChevronDown } from "lucide-react"

export interface SurveyResult {
  frames: SurveyFrame[]
  markedWaypoints: Waypoint[]
  aiWaypoints: Waypoint[]
  trails: SurveyTrail[]
  // The floor the mapper was on when the survey ended, so the app can stay on
  // it instead of snapping back to Ground.
  endFloor: number
  aiError?: string
}

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  // Fallback location for marks/frames when there's no live GPS fix, and the
  // venue name used to ground the AI sign-reading prompt.
  venueCenter: Coordinates
  venueName: string
  onClose: () => void
  onSurveyComplete: (result: SurveyResult) => void
}

const ANNOTATION_TYPES: WaypointType[] = ["ward", "department", "lift", "stairs", "toilet", "exit", "reception", "canteen", "pharmacy", "other"]

export default function SurveyMode({ currentFloor, currentPosition, venueCenter, venueName, onClose, onSurveyComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureInterval = useRef<NodeJS.Timeout | null>(null)
  const frames = useRef<SurveyFrame[]>([])
  const markedWaypoints = useRef<Waypoint[]>([])
  const trailPoints = useRef<{ lat: number; lng: number; floor: number }[]>([])
  // Keep the latest GPS fix in a ref so the capture interval always reads a fresh
  // position rather than the one captured in its closure when recording started.
  const positionRef = useRef<Coordinates | null>(currentPosition)
  positionRef.current = currentPosition

  // The floor being surveyed right now. You step this as you move between floors
  // so each captured frame / mark is tagged with the floor it was actually on,
  // instead of everything collapsing onto the floor you started on.
  const [surveyFloor, setSurveyFloor] = useState(currentFloor)
  const surveyFloorRef = useRef(surveyFloor)
  surveyFloorRef.current = surveyFloor

  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [markedCount, setMarkedCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [annotationName, setAnnotationName] = useState("")
  const [annotationType, setAnnotationType] = useState<WaypointType>("ward")
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const elapsedRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setPermissionDenied(true)
    }
  }

  function stopCamera() {
    if (captureInterval.current) clearInterval(captureInterval.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  function startRecording() {
    setRecording(true)
    setElapsed(0)
    frames.current = []
    markedWaypoints.current = []
    trailPoints.current = []
    setFrameCount(0)
    setMarkedCount(0)

    captureInterval.current = setInterval(captureFrame, 3000)
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }

  async function stopRecording() {
    setRecording(false)
    if (captureInterval.current) clearInterval(captureInterval.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)

    // Split the walked breadcrumbs into one trail per floor, so a multi-floor
    // walk draws a separate route on each floor rather than one tangled line.
    const trails: SurveyTrail[] = []
    let segment: SurveyTrail | null = null
    trailPoints.current.forEach((p) => {
      if (!segment || segment.floor !== p.floor) {
        segment = { id: `trail-${Date.now()}-${trails.length}`, floor: p.floor, points: [] }
        trails.push(segment)
      }
      segment.points.push({ lat: p.lat, lng: p.lng })
    })
    const floorTrails = trails.filter((t) => t.points.length >= 2)

    // Send the captured frames to the server to read on-camera signage into waypoints.
    let aiWaypoints: Waypoint[] = []
    let aiError: string | undefined
    if (frames.current.length > 0) {
      setAnalyzing(true)
      try {
        const res = await fetch("/api/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames: frames.current, venueName }),
        })
        const data = await res.json()
        aiWaypoints = Array.isArray(data.waypoints) ? data.waypoints : []
        if (data.error) aiError = data.error as string
      } catch {
        aiError = "network"
      }
      setAnalyzing(false)
    }

    onSurveyComplete({
      frames: frames.current,
      markedWaypoints: markedWaypoints.current,
      aiWaypoints,
      trails: floorTrails,
      endFloor: surveyFloorRef.current,
      aiError,
    })
  }

  function captureFrame(annotation?: string) {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx || video.readyState < 2) return

    canvas.width = 640
    canvas.height = 360
    ctx.drawImage(video, 0, 0, 640, 360)
    const imageData = canvas.toDataURL("image/jpeg", 0.5)

    const position = positionRef.current ?? venueCenter
    const floor = surveyFloorRef.current
    const frame: SurveyFrame = {
      timestamp: Date.now(),
      imageData,
      coordinates: position,
      heading: 0,
      floor,
      annotation,
    }

    frames.current.push(frame)
    // Drop a breadcrumb at our live position (tagged with the current floor) so
    // the walked route can be drawn per floor.
    if (positionRef.current) {
      trailPoints.current.push({ ...positionRef.current, floor })
    }
    setFrameCount((c) => c + 1)
  }

  function saveAnnotation() {
    const name = annotationName.trim()
    if (!name) return
    captureFrame(`${WAYPOINT_TYPE_ICONS[annotationType]} ${name} (${WAYPOINT_TYPE_LABELS[annotationType]})`)

    // Persist the marked spot as a real waypoint so it appears on the map and in search.
    markedWaypoints.current.push({
      id: `survey-${Date.now()}`,
      name,
      type: annotationType,
      coordinates: positionRef.current ?? venueCenter,
      floor: surveyFloorRef.current,
      description: "Added via Survey Mode",
    })
    setMarkedCount((c) => c + 1)

    setShowAnnotation(false)
    setAnnotationName("")
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  }

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <span className="text-5xl mb-4">📷</span>
        <h2 className="text-xl font-bold mb-2">Camera access needed</h2>
        <p className="text-sm text-gray-300 mb-6">Allow camera access to use Survey Mode.</p>
        <button onClick={onClose} className="bg-[#005EB8] text-white px-6 py-3 rounded-xl font-semibold">Go back</button>
      </div>
    )
  }

  if (analyzing) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5" />
        <h2 className="text-lg font-bold mb-1">Reading your survey…</h2>
        <p className="text-sm text-gray-300">Scanning the footage for signs and rooms to add to the map.</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black">
      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Floor stepper — set the floor as you move between floors */}
      {!showAnnotation && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center bg-black/55 rounded-2xl p-1.5 gap-1">
          <button
            onClick={() => setSurveyFloor((f) => Math.min(f + 1, 30))}
            className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center active:bg-white/30"
            aria-label="Floor up"
          >
            <ChevronUp size={22} />
          </button>
          <div className="text-white text-center leading-tight py-1">
            <div className="text-[10px] text-gray-300">Floor</div>
            <div className="text-lg font-bold">{floorShortLabel(surveyFloor)}</div>
          </div>
          <button
            onClick={() => setSurveyFloor((f) => Math.max(f - 1, -5))}
            className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center active:bg-white/30"
            aria-label="Floor down"
          >
            <ChevronDown size={22} />
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-4 pt-safe-snug pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onClose} className="text-white bg-black/40 rounded-full p-2">
            <X size={22} />
          </button>
          <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            {recording && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
            <span className="text-white text-sm font-mono font-bold">
              {recording ? `● REC  ${formatTime(elapsed)}` : "SURVEY MODE"}
            </span>
          </div>
          <div className="w-10" />
        </div>

        {recording && (
          <div className="flex items-center justify-center gap-3 mt-1">
            <div className="bg-black/50 rounded-full px-3 py-1">
              <p className="text-white text-xs">📸 {frameCount} frames</p>
            </div>
            <div className="bg-black/50 rounded-full px-3 py-1">
              <p className="text-white text-xs">🏢 {surveyFloor === 0 ? "Ground" : `Floor ${surveyFloor}`}</p>
            </div>
            <div className="bg-black/50 rounded-full px-3 py-1">
              <p className="text-white text-xs">📍 {markedCount} marked</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!showAnnotation ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-6 pb-safe-bar">
          {!recording ? (
            <div className="text-center mb-4">
              <p className="text-white text-sm mb-1">Walk through the area with the camera up</p>
              <p className="text-gray-400 text-xs">
                A frame is captured every 3s. When you stop, signs in the footage are read into map points — and tap “Mark Location” to add a spot yourself. Use the ▲▼ floor buttons each time you change floor.
              </p>
            </div>
          ) : (
            <div className="text-center mb-4">
              <p className="text-white text-sm">Recording — keep signs &amp; door plates in view</p>
              <p className="text-gray-400 text-xs">Tap “Mark Location” at a key point, or just keep walking</p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            {!recording ? (
              <button
                onClick={startRecording}
                className="flex-1 bg-red-600 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2"
              >
                <span className="w-3 h-3 bg-white rounded-full" />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowAnnotation(true)}
                  className="flex-1 bg-[#005EB8] text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <MapPin size={18} />
                  Mark Location
                </button>
                <button
                  onClick={stopRecording}
                  className="flex-1 bg-white text-gray-900 rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Square size={18} />
                  Stop &amp; Map
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Annotation panel */
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl px-4 pt-4 pb-safe-bar slide-up">
          <h3 className="font-bold text-gray-900 mb-3">What is at this location?</h3>
          <input
            autoFocus
            value={annotationName}
            onChange={(e) => setAnnotationName(e.target.value)}
            placeholder="e.g. Ward 5B, Main Lift, Toilets..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#005EB8]"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {ANNOTATION_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setAnnotationType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  annotationType === t
                    ? "bg-[#005EB8] text-white border-[#005EB8]"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {WAYPOINT_TYPE_ICONS[t]} {WAYPOINT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnnotation(false)}
              className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              onClick={saveAnnotation}
              disabled={!annotationName.trim()}
              className="flex-1 bg-[#005EB8] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={16} />
              Save &amp; Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
