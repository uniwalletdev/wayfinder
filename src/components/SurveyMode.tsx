"use client"

import { useEffect, useRef, useState } from "react"
import { SurveyFrame } from "@/lib/types"
import { WaypointType } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS } from "@/lib/gosh-data"
import { X, Square, MapPin, Upload, Check } from "lucide-react"

interface Props {
  currentFloor: number
  onClose: () => void
  onSurveyComplete: (frames: SurveyFrame[]) => void
}

const ANNOTATION_TYPES: WaypointType[] = ["ward", "department", "lift", "stairs", "toilet", "exit", "reception", "canteen", "pharmacy", "other"]

export default function SurveyMode({ currentFloor, onClose, onSurveyComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureInterval = useRef<NodeJS.Timeout | null>(null)
  const frames = useRef<SurveyFrame[]>([])

  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [annotationName, setAnnotationName] = useState("")
  const [annotationType, setAnnotationType] = useState<WaypointType>("ward")
  const [permissionDenied, setPermissionDenied] = useState(false)
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
    setFrameCount(0)

    captureInterval.current = setInterval(captureFrame, 3000)
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }

  function stopRecording() {
    setRecording(false)
    if (captureInterval.current) clearInterval(captureInterval.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    onSurveyComplete(frames.current)
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

    const frame: SurveyFrame = {
      timestamp: Date.now(),
      imageData,
      coordinates: { lat: 51.5225, lng: -0.1199 },
      heading: 0,
      floor: currentFloor,
      annotation,
    }

    frames.current.push(frame)
    setFrameCount((c) => c + 1)
  }

  function saveAnnotation() {
    if (!annotationName.trim()) return
    captureFrame(`${WAYPOINT_TYPE_ICONS[annotationType]} ${annotationName} (${WAYPOINT_TYPE_LABELS[annotationType]})`)
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

  return (
    <div className="fixed inset-0 z-[300] bg-black">
      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
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
              <p className="text-white text-xs">🏢 Floor {currentFloor === 0 ? "G" : currentFloor}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!showAnnotation ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          {!recording ? (
            <div className="text-center mb-4">
              <p className="text-white text-sm mb-1">Walk your route and the app will record it</p>
              <p className="text-gray-400 text-xs">Captures a frame every 3 seconds automatically</p>
            </div>
          ) : (
            <div className="text-center mb-4">
              <p className="text-white text-sm">Walking and recording…</p>
              <p className="text-gray-400 text-xs">Tap "Mark Location" when you reach a key point</p>
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
                  Stop & Upload
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Annotation panel */
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 slide-up">
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
              Save & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
