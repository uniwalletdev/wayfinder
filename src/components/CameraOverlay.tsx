"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { X, Zap, ZapOff } from "lucide-react"

interface Props {
  mode: "qr" | "live"
  onQRDetected: (data: string) => void
  onClose: () => void
  onFrameCapture?: (imageData: string) => void
}

export default function CameraOverlay({ mode, onQRDetected, onClose, onFrameCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanInterval = useRef<NodeJS.Timeout | null>(null)
  const [scanning, setScanning] = useState(true)
  const [detected, setDetected] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

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

      if (mode === "qr") {
        scanInterval.current = setInterval(scanForQR, 300)
      } else {
        scanInterval.current = setInterval(captureFrame, 3000)
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
      setScanning(false)
      if (scanInterval.current) clearInterval(scanInterval.current)
      setTimeout(() => {
        onQRDetected(qr.data)
        onClose()
      }, 600)
    }
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current || !onFrameCapture) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx || video.readyState < 2) return

    canvas.width = 640
    canvas.height = 360
    ctx.drawImage(video, 0, 0, 640, 360)
    const data = canvas.toDataURL("image/jpeg", 0.6)
    onFrameCapture(data)
  }

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <span className="text-5xl mb-4">📷</span>
        <h2 className="text-xl font-bold mb-2">Camera access needed</h2>
        <p className="text-sm text-gray-300 mb-6">
          Allow camera access in your browser settings to use QR scanning and live positioning.
        </p>
        <button onClick={onClose} className="bg-[#005EB8] text-white px-6 py-3 rounded-xl font-semibold">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-4 pt-safe-snug pb-4 flex items-center justify-between">
        <button onClick={onClose} className="text-white bg-black/40 rounded-full p-2">
          <X size={22} />
        </button>
        <p className="text-white font-semibold text-sm">
          {mode === "qr" ? "Scan QR Code" : "Live Positioning"}
        </p>
        <div className="w-10" />
      </div>

      {mode === "qr" && (
        <>
          {/* QR finder overlay */}
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
      )}

      {mode === "live" && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap size={16} className="text-[#00BFFF]" />
            <p className="text-white text-sm font-semibold">Live positioning active</p>
          </div>
          <p className="text-gray-300 text-xs">Capturing frames every 3s to track your position</p>
        </div>
      )}
    </div>
  )
}
