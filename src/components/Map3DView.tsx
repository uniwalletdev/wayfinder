"use client"

import { useEffect, useMemo, useRef, useState, MutableRefObject } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { LocateFixed } from "lucide-react"
import { Waypoint, Route, Coordinates, SurveyTrail, FloorPlan } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, getAvailableFloors } from "@/lib/waypoint-meta"
import { buildFloorSchematic } from "@/lib/schematic"
import { enuOffset } from "@/lib/geo-local"

// ── 3D map view ──────────────────────────────────────────────────────────────
// The "3D" half of the map's 2D/3D toggle: the same venue the Leaflet map shows,
// rebuilt as a rotatable three.js model. Floors become stacked decks — plan
// images textured onto plates, surveyed floors extruded from their corridor
// schematic — with the current floor solid and the others ghosted. The route,
// waypoints and the you-are-here dot render at the current floor's height, so
// switching floors visibly moves you up and down the building.
//
// It deliberately mirrors FloorPlanMap's contract (same props, same MapHandle
// flyTo, same follow-while-navigating behaviour) so WayfinderApp can swap the
// two views without special-casing either.

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  heading: number | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  // ENU origin and default camera target — the active venue's centre.
  center: Coordinates
  defaultZoom?: number
  floorPlans: FloorPlan[]
  waypoints: Waypoint[]
  trails?: SurveyTrail[]
  onMapReady: () => void
  mapHandleRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void; zoomIn: () => void; zoomOut: () => void } | null>
  // Light (default) or dark scene background — the map-style floating control.
  dark?: boolean
}

const NHS_BLUE = 0x005eb8
const NHS_RED = 0xda291c
const ROUTE_BLUE = 0x0a84ff

// Vertical rhythm of the model. A storey of ~4m reads correctly next to
// metre-scaled plan footprints; everything on a floor sits just above its deck.
const FLOOR_HEIGHT_M = 4
const WALL_HEIGHT_M = 2.6
const CHEVRON_SPACING_M = 4
const MAX_CHEVRONS = 300

const floorY = (floor: number) => floor * FLOOR_HEIGHT_M

// Leaflet zoom → camera distance, so flyTo(latlng, zoom) means roughly the same
// framing in both views (venue defaultZoom 18 ≈ a whole small building).
const zoomToDistance = (zoom: number) =>
  THREE.MathUtils.clamp(140 * Math.pow(2, 18 - zoom), 15, 3000)

export default function Map3DView({
  currentFloor,
  currentPosition,
  heading,
  destination,
  route,
  isNavigating,
  center,
  defaultZoom = 18,
  floorPlans,
  waypoints,
  trails = [],
  onMapReady,
  mapHandleRef,
  dark = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const groundRef = useRef<THREE.Mesh | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const buildingRef = useRef<THREE.Group | null>(null)
  const markersRef = useRef<THREE.Group | null>(null)
  const routeGroupRef = useRef<THREE.Group | null>(null)
  const userGroupRef = useRef<THREE.Group | null>(null)
  const textureCacheRef = useRef(new Map<string, Promise<THREE.Texture | null>>())
  const framedDestRef = useRef<string | null>(null)

  // Geographic → local metres (x = east, z = −north, y = up), origin at the
  // venue centre. Shared by every mesh so the whole model lives in one space.
  const toLocal = useMemo(() => {
    return (c: Coordinates, y = 0): THREE.Vector3 => {
      const { east, north } = enuOffset(center, c)
      return new THREE.Vector3(east, y, -north)
    }
  }, [center])
  // The animation loop and flyTo handle live in the run-once init effect; they
  // read the projection through a ref so a venue switch retargets them too.
  const toLocalRef = useRef(toLocal)

  // Same follow/explore split as the 2D map: navigation keeps the camera glued
  // to the walker until they grab the view, then a re-centre button comes back.
  const [following, setFollowing] = useState(true)
  const followingRef = useRef(true)
  const positionRef = useRef<Coordinates | null>(currentPosition)
  const isNavigatingRef = useRef(isNavigating)
  const currentFloorRef = useRef(currentFloor)

  // Mirror the live values the animation loop reads, so it never re-subscribes.
  useEffect(() => {
    toLocalRef.current = toLocal
    positionRef.current = currentPosition
    isNavigatingRef.current = isNavigating
    currentFloorRef.current = currentFloor
  })

  const setFollow = (v: boolean) => {
    followingRef.current = v
    setFollowing(v)
  }

  // Init the scene once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd9e6f2)
    scene.fog = new THREE.Fog(0xd9e6f2, 900, 4200)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.5,
      8000
    )
    // Start south of the venue looking north, so the model opens the same way
    // up as the north-up 2D map.
    const dist = zoomToDistance(defaultZoom)
    camera.position.set(0, dist * 0.85, dist * 0.75)
    cameraRef.current = camera

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 0.8)
    sun.position.set(120, 300, -180)
    scene.add(sun)

    // Neutral ground plate, in place of the 2D basemap tiles.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4000, 64),
      new THREE.MeshLambertMaterial({ color: 0xece9e1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    scene.add(ground)
    groundRef.current = ground

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, floorY(currentFloorRef.current), 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2 - 0.06 // never dip below the ground
    controls.minDistance = 8
    controls.maxDistance = 3000
    // Grabbing the view means the user wants to explore — pause follow.
    controls.addEventListener("start", () => setFollow(false))
    controlsRef.current = controls

    const building = new THREE.Group()
    const markers = new THREE.Group()
    const routeGroup = new THREE.Group()
    const userGroup = new THREE.Group()
    userGroup.visible = false
    scene.add(building, markers, routeGroup, userGroup)
    buildingRef.current = building
    markersRef.current = markers
    routeGroupRef.current = routeGroup
    userGroupRef.current = userGroup
    buildUserMarker(userGroup)

    const clock = new THREE.Clock()
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime()

      // Follow the walker while navigating: slide the orbit target (and the
      // camera with it, keeping the view angle) toward the live position.
      if (followingRef.current && isNavigatingRef.current && positionRef.current) {
        const target = toLocalRef.current(positionRef.current, floorY(currentFloorRef.current))
        const delta = target.clone().sub(controls.target).multiplyScalar(0.08)
        controls.target.add(delta)
        camera.position.add(delta)
      }

      // Idle motion: sonar pulse on the you-are-here dot, bob + spin on the
      // destination beacon — the 3D cousins of the 2D map's CSS animations.
      const pulse = userGroup.getObjectByName("pulse") as THREE.Mesh | undefined
      if (pulse) {
        const k = (t % 2.4) / 2.4
        pulse.scale.setScalar(0.6 + k * 2.6)
        ;(pulse.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k)
      }
      const beacon = routeGroup.getObjectByName("beacon")
      if (beacon) {
        beacon.rotation.y = t * 0.8
        beacon.position.y = beacon.userData.baseY + Math.sin(t * 2.2) * 0.25
      }

      // Keep label sprites readable at any distance by scaling them with the
      // camera range — geo-sized text would vanish from a wide view.
      const labelScale = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / 42, 0.5, 8)
      markers.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          o.scale.set(o.userData.aspect * 1.7 * labelScale, 1.7 * labelScale, 1)
        }
      })

      controls.update()
      renderer.render(scene, camera)
    })

    const onResize = () => {
      const w = container.clientWidth
      const h = Math.max(container.clientHeight, 1)
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    // Expose the same imperative handle as the Leaflet map, so every existing
    // flyTo call site (first GPS fix, venue switch, re-centre) drives this view
    // unchanged: retarget the orbit, keep the current viewing direction, and
    // set the range from the requested zoom.
    if (mapHandleRef) {
      const scaleDistance = (factor: number) => {
        const dir = camera.position.clone().sub(controls.target)
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 1)
        const dist = THREE.MathUtils.clamp(dir.length() * factor, controls.minDistance, controls.maxDistance)
        dir.normalize().multiplyScalar(dist)
        camera.position.copy(controls.target).add(dir)
      }
      mapHandleRef.current = {
        flyTo: ([lat, lng], zoom) => {
          const target = toLocalRef.current({ lat, lng }, floorY(currentFloorRef.current))
          const dir = camera.position.clone().sub(controls.target)
          if (dir.lengthSq() < 1e-6) dir.set(0, 1, 1)
          dir.normalize().multiplyScalar(zoomToDistance(zoom))
          controls.target.copy(target)
          camera.position.copy(target).add(dir)
        },
        zoomIn: () => scaleDistance(0.8),
        zoomOut: () => scaleDistance(1.25),
      }
    }
    onMapReady()

    return () => {
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      scene.traverse(disposeObject)
      renderer.dispose()
      container.removeChild(renderer.domElement)
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      if (mapHandleRef) mapHandleRef.current = null
    }
    // The scene is built once; data changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Light/dark scene background — the 3D cousin of the 2D map's tile swap.
  useEffect(() => {
    const scene = sceneRef.current
    const ground = groundRef.current
    if (!scene || !ground) return
    const bg = dark ? 0x0c1928 : 0xd9e6f2
    scene.background = new THREE.Color(bg)
    if (scene.fog && scene.fog instanceof THREE.Fog) scene.fog.color.set(bg)
    ;(ground.material as THREE.MeshLambertMaterial).color.set(dark ? 0x0f2036 : 0xece9e1)
  }, [dark])

  // Build the building: one deck group per floor. Plan floors get a textured
  // plate; floors that were only walked get their corridor/room schematic
  // extruded instead, so a surveyed place still reads as a building.
  useEffect(() => {
    const building = buildingRef.current
    if (!building) return

    clearGroup(building)
    let alive = true

    const floors = getAvailableFloors(floorPlans, waypoints)
    trails.forEach((tr) => { if (!floors.includes(tr.floor)) floors.push(tr.floor) })

    for (const floor of floors) {
      const deck = new THREE.Group()
      deck.userData.floor = floor
      building.add(deck)
      const y = floorY(floor)

      const plan = floorPlans.find((fp) => fp.floor === floor)
      if (plan) {
        // Normalise the bounds corners: seed venues store [[S,W],[N,E]] while
        // uploaded plans store [[N,W],[S,E]] — Leaflet accepts both, so must we.
        const south = Math.min(plan.bounds[0][0], plan.bounds[1][0])
        const north = Math.max(plan.bounds[0][0], plan.bounds[1][0])
        const west = Math.min(plan.bounds[0][1], plan.bounds[1][1])
        const east = Math.max(plan.bounds[0][1], plan.bounds[1][1])
        const sw = toLocal({ lat: south, lng: west }, y)
        const ne = toLocal({ lat: north, lng: east }, y)
        const w = Math.abs(ne.x - sw.x)
        const d = Math.abs(sw.z - ne.z)

        const mat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          transparent: true,
          side: THREE.DoubleSide,
        })
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat)
        plate.rotation.x = -Math.PI / 2
        plate.position.set((sw.x + ne.x) / 2, y, (sw.z + ne.z) / 2)
        deck.add(plate)

        // Thin edge frame so ghosted decks still read as storeys from the side.
        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)),
          new THREE.LineBasicMaterial({ color: NHS_BLUE, transparent: true })
        )
        frame.rotation.x = -Math.PI / 2
        frame.position.copy(plate.position)
        deck.add(frame)

        void loadPlanTexture(plan.imageUrl, textureCacheRef.current).then((tex) => {
          // The deck may have been rebuilt (venue switch) while loading.
          if (!alive || !tex || plate.parent !== deck) return
          mat.map = tex
          mat.needsUpdate = true
        })
      } else {
        // Extrude the same schematic the 2D map draws for surveyed floors:
        // corridor ribbons as floor polygons, rooms as low glassy blocks.
        const schematic = buildFloorSchematic(floor, trails, waypoints)
        if (schematic) {
          for (const ring of schematic.corridors) {
            const shape = ringToShape(ring, center)
            if (!shape) continue
            const mesh = new THREE.Mesh(
              new THREE.ShapeGeometry(shape),
              new THREE.MeshLambertMaterial({ color: 0xe2e8f0, transparent: true, side: THREE.DoubleSide })
            )
            mesh.rotation.x = -Math.PI / 2
            mesh.position.y = y + 0.02
            deck.add(mesh)
          }
          for (const room of schematic.rooms) {
            const shape = ringToShape(room.polygon, center)
            if (!shape) continue
            const mesh = new THREE.Mesh(
              new THREE.ExtrudeGeometry(shape, { depth: WALL_HEIGHT_M, bevelEnabled: false }),
              new THREE.MeshLambertMaterial({ color: 0xf8fafc, transparent: true })
            )
            mesh.rotation.x = -Math.PI / 2
            mesh.position.y = y
            deck.add(mesh)
          }
        }
      }

      // Walked breadcrumb trails, matching the 2D map's dashed purple lines.
      trails
        .filter((tr) => tr.floor === floor && tr.points.length >= 2)
        .forEach((tr) => {
          const pts = tr.points.map((p) => toLocal(p, y + 0.06))
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineDashedMaterial({ color: 0x7c3aed, transparent: true, dashSize: 1.2, gapSize: 1.2 })
          )
          line.computeLineDistances()
          deck.add(line)
        })
    }

    applyFloorEmphasis(building, currentFloorRef.current)
    return () => {
      alive = false
    }
    // currentFloor is applied by the effect below without rebuilding geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorPlans, waypoints, trails, toLocal])

  // Switching floors just re-weights the decks (solid vs ghost) and lifts the
  // orbit target to the new storey — no geometry rebuild.
  useEffect(() => {
    const building = buildingRef.current
    if (building) applyFloorEmphasis(building, currentFloor)
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (controls && camera) {
      const dy = floorY(currentFloor) - controls.target.y
      controls.target.y += dy
      camera.position.y += dy
    }
  }, [currentFloor])

  // Waypoint pins + labels for the current floor.
  useEffect(() => {
    const markers = markersRef.current
    if (!markers) return
    clearGroup(markers)

    const y = floorY(currentFloor)
    for (const w of waypoints.filter((wp) => wp.floor === currentFloor)) {
      const isDest = destination?.id === w.id
      const pin = new THREE.Group()
      pin.position.copy(toLocal(w.coordinates, y))

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8),
        new THREE.MeshLambertMaterial({ color: isDest ? NHS_RED : NHS_BLUE })
      )
      stem.position.y = 0.75
      pin.add(stem)
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 18, 14),
        new THREE.MeshLambertMaterial({ color: isDest ? NHS_RED : 0xffffff })
      )
      head.position.y = 1.7
      pin.add(head)

      const label = makeLabelSprite(`${WAYPOINT_TYPE_ICONS[w.type]} ${w.name}`, isDest)
      label.position.y = 3.1
      pin.add(label)

      markers.add(pin)
    }
  }, [waypoints, currentFloor, destination, toLocal])

  // Route ribbon + marching chevrons + destination beacon, with the same
  // framing rules as the 2D map: previews frame the whole route; starting
  // navigation frames once, then follow takes over.
  useEffect(() => {
    const group = routeGroupRef.current
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!group) return
    clearGroup(group)

    if (!route || !destination || route.geometry.length < 2) {
      framedDestRef.current = null
      setFollow(true)
      return
    }

    const y = floorY(currentFloor)
    const pts = route.geometry.map((p) => toLocal(p, y + 0.35))

    // The line itself: a tube along the exact route geometry (a path of
    // straight segments — no spline smoothing, so corners stay honest).
    const path = new THREE.CurvePath<THREE.Vector3>()
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].distanceTo(pts[i + 1]) > 1e-4) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
    }
    if (path.curves.length > 0) {
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(path, Math.min(pts.length * 6, 1200), 0.35, 8, false),
        new THREE.MeshLambertMaterial({ color: ROUTE_BLUE, emissive: ROUTE_BLUE, emissiveIntensity: 0.35 })
      )
      group.add(tube)
    }

    addChevrons(group, pts)

    // Destination beacon: the AR view's pillar-and-ring, in destination red.
    const dest = toLocal(destination.coordinates, 0)
    const beacon = new THREE.Group()
    beacon.name = "beacon"
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 6, 20, 1, true),
      new THREE.MeshLambertMaterial({
        color: NHS_RED, emissive: NHS_RED, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      })
    )
    pillar.position.y = 3
    beacon.add(pillar)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.16, 12, 32),
      new THREE.MeshLambertMaterial({ color: NHS_RED, emissive: NHS_RED, emissiveIntensity: 0.6 })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.2
    beacon.add(ring)
    beacon.userData.baseY = y
    beacon.position.set(dest.x, y, dest.z)
    group.add(beacon)

    if (!controls || !camera) return
    const frame = () => frameBox(new THREE.Box3().setFromPoints(pts), camera, controls)
    if (!isNavigating) {
      frame()
      framedDestRef.current = null
    } else if (framedDestRef.current !== destination.id) {
      frame()
      framedDestRef.current = destination.id
      setFollow(true)
    }
  }, [route, destination, isNavigating, currentFloor, toLocal])

  // You-are-here dot: move the persistent marker, aim its facing cone.
  useEffect(() => {
    const user = userGroupRef.current
    if (!user) return
    if (!currentPosition) {
      user.visible = false
      return
    }
    user.visible = true
    user.position.copy(toLocal(currentPosition, floorY(currentFloor) + 0.1))
  }, [currentPosition, currentFloor, toLocal])

  useEffect(() => {
    const cone = userGroupRef.current?.getObjectByName("heading-cone")
    if (!cone) return
    cone.visible = heading != null
    // Bearing runs clockwise from north; +Y rotation is anticlockwise from
    // above, and the cone is built pointing north (−Z).
    if (heading != null) cone.rotation.y = -THREE.MathUtils.degToRad(heading)
  }, [heading, currentPosition])

  const recenter = () => {
    const pos = positionRef.current
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (pos && controls && camera) {
      const target = toLocal(pos, floorY(currentFloor))
      const dir = camera.position.clone().sub(controls.target)
      controls.target.copy(target)
      camera.position.copy(target).add(dir)
    }
    setFollow(true)
  }

  const showRecenter = isNavigating && !following && currentPosition

  return (
    <div className="relative w-full h-full" style={{ isolation: "isolate" }}>
      <div ref={containerRef} className="w-full h-full" />
      {showRecenter && (
        <button
          onClick={recenter}
          aria-label="Re-centre on my location"
          className="absolute bottom-28 right-4 z-[1000] flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#005EB8] shadow-lg active:scale-95 transition-transform"
        >
          <LocateFixed size={18} />
          Re-centre
        </button>
      )}
    </div>
  )
}

// ── Scene helpers ─────────────────────────────────────────────────────────────

// Solid vs ghost: the current floor at full strength, other storeys faded to a
// hint so the building's shape stays visible without burying the active plan.
function applyFloorEmphasis(building: THREE.Group, currentFloor: number) {
  for (const deck of building.children) {
    const isCurrent = deck.userData.floor === currentFloor
    deck.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined
      if (!mat || Array.isArray(mat)) return
      mat.opacity = isCurrent ? ((o as THREE.Line).isLine ? 0.75 : 1) : 0.13
      mat.depthWrite = isCurrent
      mat.transparent = true
    })
  }
}

// Convert a lat/lng ring into a THREE.Shape in (east, north) metres. Shapes are
// laid flat later with rotateX(-π/2), which maps shape (x, y) → world (x, −z),
// i.e. north stays north.
function ringToShape(ring: Coordinates[], origin: Coordinates): THREE.Shape | null {
  if (ring.length < 3) return null
  const shape = new THREE.Shape()
  ring.forEach((c, i) => {
    const { east, north } = enuOffset(origin, c)
    if (i === 0) shape.moveTo(east, north)
    else shape.lineTo(east, north)
  })
  shape.closePath()
  return shape
}

// Flat "follow me" arrows spaced along the route, as in the AR view.
function addChevrons(group: THREE.Group, pts: THREE.Vector3[]) {
  const geo = makeChevronGeometry()
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4,
    transparent: true, opacity: 0.95,
  })
  let placed = 0
  let carry = CHEVRON_SPACING_M / 2
  for (let i = 0; i < pts.length - 1 && placed < MAX_CHEVRONS; i++) {
    const seg = pts[i + 1].clone().sub(pts[i])
    const segLen = seg.length()
    if (segLen < 1e-3) continue
    const dir = seg.clone().normalize()
    const yaw = Math.atan2(dir.x, dir.z)
    for (let d = carry; d < segLen && placed < MAX_CHEVRONS; d += CHEVRON_SPACING_M) {
      const chevron = new THREE.Mesh(geo, mat)
      chevron.position.copy(pts[i]).addScaledVector(dir, d)
      chevron.position.y += 0.35
      chevron.rotation.y = yaw
      group.add(chevron)
      placed++
    }
    carry = (carry - segLen) % CHEVRON_SPACING_M
    if (carry < 0) carry += CHEVRON_SPACING_M
  }
}

// A flat chevron (">") pointing toward +Z, sized up from the AR view's to stay
// legible from a bird's-eye distance.
function makeChevronGeometry(): THREE.ExtrudeGeometry {
  const s = 2.4
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.28 * s)
  shape.lineTo(0.26 * s, -0.1 * s)
  shape.lineTo(0.12 * s, -0.1 * s)
  shape.lineTo(0, 0.06 * s)
  shape.lineTo(-0.12 * s, -0.1 * s)
  shape.lineTo(-0.26 * s, -0.1 * s)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  geo.center()
  return geo
}

// The blue dot, its sonar pulse ring, and the compass facing cone — built once
// and moved/aimed by the effects above.
function buildUserMarker(group: THREE.Group) {
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 20, 16),
    new THREE.MeshLambertMaterial({ color: NHS_BLUE, emissive: NHS_BLUE, emissiveIntensity: 0.35 })
  )
  core.position.y = 0.6
  group.add(core)

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  )
  halo.position.y = 0.6
  group.add(halo)

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.5, 40),
    new THREE.MeshBasicMaterial({ color: NHS_BLUE, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  )
  pulse.name = "pulse"
  pulse.rotation.x = -Math.PI / 2
  pulse.position.y = 0.05
  group.add(pulse)

  // Facing wedge, built pointing north (−Z); yawed to the live heading.
  const sector = new THREE.Shape()
  sector.moveTo(0, 0)
  sector.absarc(0, 0, 3.2, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45, false)
  sector.closePath()
  const cone = new THREE.Mesh(
    new THREE.ShapeGeometry(sector, 24),
    new THREE.MeshBasicMaterial({ color: ROUTE_BLUE, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  )
  cone.name = "heading-cone"
  cone.rotation.x = -Math.PI / 2
  cone.position.y = 0.08
  cone.visible = false
  group.add(cone)
}

// A text label rendered to canvas and shown as a sprite; distance-scaled each
// frame in the render loop so it stays readable from any range.
function makeLabelSprite(text: string, highlight: boolean): THREE.Sprite {
  const pad = 14
  const fontPx = 30
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  ctx.font = `600 ${fontPx}px Arial, sans-serif`
  const textW = ctx.measureText(text).width
  canvas.width = Math.ceil(textW + pad * 2)
  canvas.height = fontPx + pad * 1.6
  const r = canvas.height / 2

  // Rounded pill background.
  ctx.fillStyle = highlight ? "rgba(218,41,28,0.92)" : "rgba(255,255,255,0.92)"
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(canvas.width - r, 0)
  ctx.arc(canvas.width - r, r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(r, canvas.height)
  ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2)
  ctx.fill()

  ctx.font = `600 ${fontPx}px Arial, sans-serif`
  ctx.fillStyle = highlight ? "#ffffff" : "#1f2937"
  ctx.textBaseline = "middle"
  ctx.fillText(text, pad, canvas.height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  )
  sprite.userData.aspect = canvas.width / canvas.height
  sprite.renderOrder = 10
  return sprite
}

// Rasterise a plan image (SVG or bitmap, URL or data URL) to a canvas texture.
// Going through a canvas sidesteps SVGs without width/height attributes, which
// three's TextureLoader can't size. Failures resolve to null and the deck just
// stays an untextured plate.
function loadPlanTexture(
  url: string,
  cache: Map<string, Promise<THREE.Texture | null>>
): Promise<THREE.Texture | null> {
  const hit = cache.get(url)
  if (hit) return hit

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const w = img.naturalWidth || 800
        const h = img.naturalHeight || 620
        const scale = Math.min(2048 / Math.max(w, h), 4)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 4
        resolve(texture)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  cache.set(url, promise)
  return promise
}

// Frame a bounding box the way the 2D map's fitBounds does: aim at its centre
// and back off far enough (plus padding) to take it all in.
function frameBox(box: THREE.Box3, camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  const centerPt = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const span = Math.max(size.x, size.z, 10)
  const dist = THREE.MathUtils.clamp(
    (span * 1.35) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
    20,
    2800
  )
  const dir = camera.position.clone().sub(controls.target)
  if (dir.lengthSq() < 1e-6) dir.set(0, 1, 1)
  dir.normalize().multiplyScalar(dist)
  // Keep a raised vantage so "frame the route" never means a grazing side-on view.
  if (dir.y < dist * 0.45) {
    dir.y = dist * 0.45
    dir.setLength(dist)
  }
  controls.target.copy(centerPt)
  camera.position.copy(centerPt).add(dir)
}

function clearGroup(group: THREE.Group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i]
    group.remove(child)
    child.traverse(disposeObject)
  }
}

function disposeObject(o: THREE.Object3D) {
  const mesh = o as THREE.Mesh
  if (mesh.geometry) mesh.geometry.dispose()
  const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
  else if (mat) mat.dispose()
}
