"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { X, QrCode, Crosshair, Loader2, Compass } from "lucide-react"
import type { Coordinates, Route, RouteStep, Waypoint } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS } from "@/lib/waypoint-meta"
import { distanceMeters } from "@/lib/routing"
import { enuOffset } from "@/lib/geo-local"

// ── Immersive WebXR AR navigation ────────────────────────────────────────────
// The "real" AR view. It opens an immersive-ar WebXR session, which on a
// supported phone (Android Chrome + ARCore) hands us a SLAM-tracked camera pose
// — the same visual-inertial tracking that pins objects to the floor in native
// AR apps. We seed localisation once from a known fix (the user's GPS/QR
// position + compass heading), project the route's geographic waypoints into the
// session's metre-based local space, and drop a trail of chevrons and a
// destination beacon on the floor. From then on the device's SLAM carries the
// pose as the user walks, so the trail stays glued to the ground instead of
// floating on a flat overlay.
//
// This is genuine on-device SLAM, seeded by our own fix — not server-side visual
// relocalisation (that needs a pre-scanned point cloud of the building). If the
// seed drifts, "Re-align" or a QR scan re-seeds it.

interface Props {
  position: Coordinates | null
  heading: number | null
  route: Route
  currentStep: RouteStep | null
  destination: Waypoint
  onExit: () => void
  onScanQR: () => void
  // Called if the AR session can't start, so the parent can drop back to the
  // compass overlay rather than leaving the user on a dead screen.
  onFallback: (reason: string) => void
}

const UP = new THREE.Vector3(0, 1, 0)
const NHS_BLUE = 0x005eb8
const NHS_GREEN = 0x009639
const CHEVRON_SPACING_M = 1.6

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }

export default function ArNavView({
  position,
  heading,
  route,
  currentStep,
  destination,
  onExit,
  onScanQR,
  onFallback,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sessionRef = useRef<XRSession | null>(null)
  const pathGroupRef = useRef<THREE.Group | null>(null)
  const headingRef = useRef<number | null>(heading)
  const positionRef = useRef<Coordinates | null>(position)
  const calibratedRef = useRef(false)
  // A recalibration request, applied on the next rendered frame where we can read
  // a fresh camera pose. `true` on first entry to force the initial alignment.
  const wantAlignRef = useRef(true)

  const [phase, setPhase] = useState<"starting" | "aligning" | "guiding">("starting")

  // Keep the latest fix + heading in refs so the animation loop reads live values
  // without restarting the session.
  useEffect(() => { headingRef.current = heading }, [heading])
  useEffect(() => { positionRef.current = position }, [position])

  // Our own compass listener: the parent already unlocked the sensor from a tap,
  // and reading it here keeps calibration snapping to the freshest heading.
  useEffect(() => {
    const onOrient = (event: Event) => {
      const e = event as OrientationEvent
      if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
        headingRef.current = e.webkitCompassHeading
      } else if (e.absolute && typeof e.alpha === "number") {
        headingRef.current = (360 - e.alpha) % 360
      }
    }
    window.addEventListener("deviceorientationabsolute", onOrient, true)
    window.addEventListener("deviceorientation", onOrient, true)
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient, true)
      window.removeEventListener("deviceorientation", onOrient, true)
    }
  }, [])

  const requestAlign = useCallback(() => {
    wantAlignRef.current = true
    setPhase("aligning")
  }, [])

  useEffect(() => {
    let disposed = false
    const clock = new THREE.Clock()

    async function start() {
      const xr = navigator.xr
      if (!xr) {
        onFallback("This device doesn't support immersive AR.")
        return
      }
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl2", { xrCompatible: true, alpha: true, antialias: true })
      if (!gl) {
        onFallback("Couldn't start the AR graphics context.")
        return
      }

      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.xr.enabled = true
      renderer.xr.setReferenceSpaceType("local-floor")
      rendererRef.current = renderer

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.1))
      const dir = new THREE.DirectionalLight(0xffffff, 0.7)
      dir.position.set(1, 3, 2)
      scene.add(dir)

      const pathGroup = new THREE.Group()
      scene.add(pathGroup)
      pathGroupRef.current = pathGroup

      let session: XRSession
      try {
        session = await xr.requestSession("immersive-ar", {
          requiredFeatures: ["local-floor"],
          optionalFeatures: ["dom-overlay", "anchors", "hit-test"],
          domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
        })
      } catch (e) {
        onFallback(e instanceof Error ? e.message : "AR session was refused.")
        return
      }
      if (disposed) { session.end().catch(() => {}); return }
      sessionRef.current = session
      session.addEventListener("end", () => {
        if (!disposed) onExit()
      })

      await renderer.xr.setSession(session)
      setPhase(headingRef.current == null ? "aligning" : "aligning")

      renderer.setAnimationLoop(() => {
        // Spin the beacon for visibility.
        const t = clock.getElapsedTime()
        const beacon = pathGroup.getObjectByName("beacon")
        if (beacon) beacon.rotation.y = t * 0.8

        renderer.render(scene, camera)

        // three updates the XR camera pose inside render(), so read it afterwards
        // to align against a fresh SLAM pose.
        if (wantAlignRef.current) {
          const h = headingRef.current
          const origin = positionRef.current
          if (h != null && origin) {
            buildPath(pathGroup, renderer.xr.getCamera(), h, origin, route, destination)
            wantAlignRef.current = false
            calibratedRef.current = true
            setPhase("guiding")
          }
        }
      })

      setPhase(headingRef.current != null && positionRef.current ? "guiding" : "aligning")
    }

    start()

    return () => {
      disposed = true
      const r = rendererRef.current
      if (r) {
        r.setAnimationLoop(null)
        r.dispose()
      }
      sessionRef.current?.end().catch(() => {})
      rendererRef.current = null
      sessionRef.current = null
    }
    // Session lifecycle is owned here; route/destination changes re-seed via
    // Re-align rather than tearing the session down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const distToNext = (() => {
    if (!position || !currentStep) return null
    const target = currentStep.waypoint?.coordinates ?? destination.coordinates
    return distanceMeters(position, target)
  })()

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[300]">
      {/* All UI here is the WebXR dom-overlay: it floats over the live AR camera. */}

      {/* Top: live instruction */}
      {phase === "guiding" && currentStep && (
        <div className="absolute top-0 left-0 right-0 pt-safe-snug px-4">
          <div className="mt-2 bg-[#005EB8] text-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2.5">
            <span className="text-2xl flex-shrink-0">{WAYPOINT_TYPE_ICONS[destination.type]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm leading-tight truncate">{currentStep.instruction}</p>
              {distToNext != null && (
                <p className="text-white/80 text-xs">
                  {distToNext < 1000 ? `${Math.round(distToNext)}m` : `${(distToNext / 1000).toFixed(1)}km`} away
                </p>
              )}
            </div>
            <button onClick={onExit} aria-label="Exit AR" className="bg-white/20 rounded-full p-1.5 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Starting / aligning coach marks */}
      {phase !== "guiding" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center pointer-events-none">
          <div className="bg-black/55 backdrop-blur-sm rounded-3xl px-6 py-7 max-w-xs pointer-events-auto">
            {phase === "starting" ? (
              <>
                <Loader2 size={40} className="text-[#00BFFF] mx-auto mb-3 animate-spin" />
                <h2 className="text-white text-lg font-bold mb-1">Starting AR…</h2>
                <p className="text-gray-200 text-sm">Point your phone at the corridor ahead.</p>
              </>
            ) : (
              <>
                <Compass size={40} className="text-[#00BFFF] mx-auto mb-3" />
                <h2 className="text-white text-lg font-bold mb-1">Line up the view</h2>
                <p className="text-gray-200 text-sm mb-5">
                  Hold the phone upright and face down the corridor, then drop the trail on the floor.
                </p>
                <button
                  onClick={requestAlign}
                  className="w-full flex items-center justify-center gap-2 bg-[#009639] text-white rounded-xl py-3 font-bold"
                >
                  <Crosshair size={18} />
                  Drop the trail
                </button>
                {heading == null && (
                  <p className="text-amber-300 text-xs mt-3">
                    Waiting for the compass — move the phone in a figure-8.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {phase === "guiding" && (
        <div className="absolute bottom-0 left-0 right-0 pb-safe-bar px-4">
          <div className="mb-3 flex gap-2">
            <button
              onClick={requestAlign}
              className="flex-1 flex items-center justify-center gap-2 bg-white/15 backdrop-blur text-white rounded-xl py-2.5 text-sm font-semibold"
            >
              <Crosshair size={16} />
              Re-align
            </button>
            <button
              onClick={onScanQR}
              className="flex-1 flex items-center justify-center gap-2 bg-white/15 backdrop-blur text-white rounded-xl py-2.5 text-sm font-semibold"
            >
              <QrCode size={16} />
              Scan to re-fix
            </button>
            <button
              onClick={onExit}
              className="flex items-center justify-center gap-2 bg-white text-[#005EB8] rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Flip if on-device testing shows arrows mirrored left↔right. Positive rotation
// about +Y in three.js is clockwise viewed from above, matching compass bearing.
const TURN_SIGN = 1

// Project the route into the AR session's local floor space and (re)build the
// chevron trail + destination beacon. Called at each alignment: it reads the
// live camera pose so "align" always trusts where the phone is pointing now.
function buildPath(
  group: THREE.Group,
  xrCam: THREE.Camera,
  headingDeg: number,
  originGeo: Coordinates,
  route: Route,
  destination: Waypoint
) {
  // Clear any previous trail.
  for (let i = group.children.length - 1; i >= 0; i--) {
    const c = group.children[i]
    group.remove(c)
    disposeDeep(c)
  }

  // Where the camera is and which way it faces, in local floor space.
  const camPos = new THREE.Vector3()
  xrCam.getWorldPosition(camPos)
  const fwd = new THREE.Vector3()
  xrCam.getWorldDirection(fwd) // the way the phone is looking (−Z)
  fwd.y = 0
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
  fwd.normalize()

  // The phone currently points along real-world bearing `headingDeg`. Rotate its
  // horizontal forward to recover the local-space directions of North and East,
  // so we can lay geographic offsets onto the floor.
  const localNorth = fwd.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad(-headingDeg * TURN_SIGN))
  const localEast = fwd.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad((90 - headingDeg) * TURN_SIGN))

  const toLocal = (g: Coordinates): THREE.Vector3 => {
    const { east, north } = enuOffset(originGeo, g)
    const off = localEast.clone().multiplyScalar(east).add(localNorth.clone().multiplyScalar(north))
    return new THREE.Vector3(camPos.x + off.x, 0, camPos.z + off.z)
  }

  const pts = route.geometry.map(toLocal)
  if (pts.length < 2) return

  // Chevrons marching along the polyline at a fixed spacing, each yawed to point
  // down the path — the "follow me" arrows on the floor.
  const chevronGeo = makeChevronGeometry()
  const chevronMat = new THREE.MeshStandardMaterial({
    color: NHS_BLUE,
    emissive: NHS_BLUE,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  })

  let carry = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const seg = b.clone().sub(a)
    const segLen = seg.length()
    if (segLen < 1e-3) continue
    const dirN = seg.clone().normalize()
    const yaw = Math.atan2(dirN.x, dirN.z) // align chevron's +Z to the segment
    for (let d = carry; d < segLen; d += CHEVRON_SPACING_M) {
      const p = a.clone().addScaledVector(dirN, d)
      const chevron = new THREE.Mesh(chevronGeo, chevronMat)
      chevron.position.set(p.x, 0.02, p.z)
      chevron.rotation.y = yaw
      group.add(chevron)
    }
    carry = (carry - segLen) % CHEVRON_SPACING_M
    if (carry < 0) carry += CHEVRON_SPACING_M
  }

  // Destination beacon: a translucent pillar + a ring so it reads from afar.
  const dest = toLocal(destination.coordinates)
  const beacon = new THREE.Group()
  beacon.name = "beacon"
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 2.2, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: NHS_GREEN,
      emissive: NHS_GREEN,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
  )
  pillar.position.y = 1.1
  beacon.add(pillar)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.06, 12, 32),
    new THREE.MeshStandardMaterial({ color: NHS_GREEN, emissive: NHS_GREEN, emissiveIntensity: 0.8 })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.05
  beacon.add(ring)
  beacon.position.set(dest.x, 0, dest.z)
  group.add(beacon)
}

// A flat chevron (">") lying on the floor, pointing toward +Z.
function makeChevronGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  // Arrow head pointing +Y in shape space; extruded thin then laid flat so +Y→+Z.
  shape.moveTo(0, 0.28)
  shape.lineTo(0.26, -0.1)
  shape.lineTo(0.12, -0.1)
  shape.lineTo(0, 0.06)
  shape.lineTo(-0.12, -0.1)
  shape.lineTo(-0.26, -0.1)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2) // lay flat: shape's +Y becomes world +Z
  geo.center()
  return geo
}

function disposeDeep(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else if (mat) (mat as THREE.Material).dispose()
  })
}
