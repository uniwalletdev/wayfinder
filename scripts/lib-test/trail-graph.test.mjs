// Checks that the faster corridor-network routing (src/lib/routing.ts,
// buildTrailPath) gives the same answers as the straightforward version it
// replaced.
//
// Stitching breadcrumbs into junctions compared every pair of nodes, and the
// shortest-path search scanned every node per round — both quadratic, and both
// ran on the main thread on every route build and every off-route rebuild while
// someone walked. The replacements bucket nodes into a grid and use a heap.
// Neither is allowed to change a single route, so this builds random corridor
// networks, routes across them with the shipped code and with a brute-force
// reference written here, and demands the same distance every time.
//
// Run: node scripts/lib-test/trail-graph.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { buildTrailPath, distanceMeters, buildRoute, shouldRouteOutdoors } = await import(fileURLToPath(new URL("routing.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

// ── Reference implementation: the original O(n²) stitch + O(n²) Dijkstra ────
const STITCH_M = 6
const DETOUR_LIMIT = 8
const SNAP_MAX_M = 30

function referencePath(from, to, trails) {
  const usable = trails.filter((t) => t.points.length >= 2)
  if (usable.length === 0) return null
  const nodes = []
  for (const t of usable) for (const p of t.points) nodes.push(p)
  if (nodes.length < 2) return null
  const adj = nodes.map(() => [])
  const w = nodes.map(() => [])
  const link = (i, j) => {
    const d = distanceMeters(nodes[i], nodes[j])
    adj[i].push(j); w[i].push(d); adj[j].push(i); w[j].push(d)
  }
  let base = 0
  for (const t of usable) {
    for (let k = 0; k < t.points.length - 1; k++) link(base + k, base + k + 1)
    base += t.points.length
  }
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (distanceMeters(nodes[i], nodes[j]) <= STITCH_M) link(i, j)

  const nearest = (p) => {
    let best = -1, bd = Infinity
    nodes.forEach((n, i) => { const d = distanceMeters(p, n); if (d < bd) { bd = d; best = i } })
    return best
  }
  const s = nearest(from), g = nearest(to)
  if (s === g) return null
  if (distanceMeters(from, nodes[s]) > SNAP_MAX_M || distanceMeters(to, nodes[g]) > SNAP_MAX_M) return null

  const n = nodes.length
  const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false)
  dist[s] = 0
  for (let iter = 0; iter < n; iter++) {
    let u = -1, ud = Infinity
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i }
    if (u === -1 || u === g) break
    done[u] = true
    adj[u].forEach((v, k) => { const nd = dist[u] + w[u][k]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u } })
  }
  if (dist[g] === Infinity) return null
  const path = []
  for (let at = g; at !== -1; at = prev[at]) path.push(at)
  path.reverse()
  const geometry = [from, ...path.map((i) => nodes[i]), to]
  let distance = 0
  for (let i = 0; i < geometry.length - 1; i++) distance += distanceMeters(geometry[i], geometry[i + 1])
  if (distance > distanceMeters(from, to) * DETOUR_LIMIT + 100) return null
  return { geometry, distance }
}

// ── Random corridor networks, reproducible ───────────────────────────────────
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const ORIGIN = { lat: 51.5225, lng: -0.1202 } // GOSH, so cos(lat) is realistic
const M_PER_LAT = 111320
const mPerLng = M_PER_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180)
const at = (east, north) => ({ lat: ORIGIN.lat + north / M_PER_LAT, lng: ORIGIN.lng + east / mPerLng })

// Walks of 2–4 m strides in a square, turning now and then, so trails cross,
// run alongside each other and sometimes touch within the stitch distance.
function randomTrails(rand, count, length, spanM, floor = 0) {
  const trails = []
  for (let t = 0; t < count; t++) {
    let e = rand() * spanM, n = rand() * spanM
    let bearing = rand() * Math.PI * 2
    const points = []
    for (let i = 0; i < length; i++) {
      points.push(at(e, n))
      if (rand() < 0.15) bearing += (rand() - 0.5) * Math.PI
      const step = 2 + rand() * 2
      e = Math.min(spanM, Math.max(0, e + Math.cos(bearing) * step))
      n = Math.min(spanM, Math.max(0, n + Math.sin(bearing) * step))
    }
    trails.push({ id: `t${t}`, floor, points })
  }
  return trails
}

const same = (a, b) => (a === null && b === null) || (a && b && Math.abs(a.distance - b.distance) < 1e-6)

group("the fast path agrees with the brute-force reference")
{
  const rand = rng(7)
  let agreed = 0, routed = 0, total = 0
  for (let net = 0; net < 12; net++) {
    const trails = randomTrails(rand, 6 + net, 25, 120)
    for (let q = 0; q < 20; q++) {
      const from = at(rand() * 120, rand() * 120)
      const to = at(rand() * 120, rand() * 120)
      const fast = buildTrailPath(from, to, trails)
      const ref = referencePath(from, to, trails)
      total++
      if (fast) routed++
      if (same(fast, ref)) agreed++
    }
  }
  check(`every one of ${total} random journeys gets the same distance`, agreed === total, `${agreed}/${total} agreed`)
  check("and a fair share of them actually followed the corridors", routed > total / 4, `${routed} routed`)
}

group("stitching links exactly the pairs within the stitch distance")
{
  // Two walks that never share a point but whose breadcrumbs come within 5 m
  // of each other must be joined; a pair whose closest breadcrumbs are 7 m
  // apart must not.
  const a = [at(0, 0), at(10, 0), at(20, 0), at(30, 0)]
  const bNear = [at(10, 5), at(15, 25), at(15, 45)]
  const bFar = [at(10, 7), at(15, 27), at(15, 47)]
  const joined = buildTrailPath(at(0, 0), at(15, 45), [{ id: "a", floor: 0, points: a }, { id: "b", floor: 0, points: bNear }])
  const apart = buildTrailPath(at(0, 0), at(15, 45), [{ id: "a", floor: 0, points: a }, { id: "b", floor: 0, points: bFar }])
  check("5 m apart: the walks join and the route crosses between them", joined !== null && joined.distance > 40)
  check("7 m apart: no junction, so no route", apart === null)
}

group("a large imported network is routed quickly")
{
  const rand = rng(99)
  const trails = randomTrails(rand, 80, 50, 400) // 4,000 breadcrumbs
  const t0 = performance.now()
  let found = 0
  for (let q = 0; q < 10; q++) {
    if (buildTrailPath(at(rand() * 400, rand() * 400), at(rand() * 400, rand() * 400), trails)) found++
  }
  const ms = performance.now() - t0
  console.log(`  (10 routes over 4,000 breadcrumbs, graph rebuilt each time: ${ms.toFixed(0)} ms)`)
  check("ten full builds and searches finish well inside a second each", ms < 10_000, `${ms.toFixed(0)} ms`)
  check("and some of them found corridors to follow", found > 0)
}

group("the route builder reuses a floor's graph across calls")
{
  // Same trails array, many builds — what happens on every position tick during
  // a route preview. Must stay fast because the graph is cached, not rebuilt.
  const rand = rng(5)
  const trails = randomTrails(rand, 60, 50, 300)
  const dest = { id: "d", name: "Ward", type: "ward", floor: 0, coordinates: at(280, 280) }
  buildRoute(at(10, 10), 0, dest, [dest], "walking", trails)
  const t0 = performance.now()
  for (let i = 0; i < 200; i++) buildRoute(at(10 + i * 0.1, 10), 0, dest, [dest], "walking", trails)
  const ms = performance.now() - t0
  console.log(`  (200 route builds on a cached 3,000-node graph: ${ms.toFixed(0)} ms)`)
  check("two hundred rebuilds on a cached graph are cheap", ms < 5_000, `${ms.toFixed(0)} ms`)
}

group("a long ground-floor hop goes outdoors only when no corridor connects it")
{
  const far = { id: "f", name: "Far block", type: "department", floor: 0, coordinates: at(399, 0) }
  const corridor = { id: "c", floor: 0, points: Array.from({ length: 101 }, (_, i) => at(i * 4, 0)) }
  check("398 m with no mapped corridor is an outdoor trip", shouldRouteOutdoors(at(1, 0), 0, far, []) === true)
  check("the same hop along a walked corridor stays indoors", shouldRouteOutdoors(at(1, 0), 0, far, [corridor]) === false)
  check("a short hop never goes outdoors", shouldRouteOutdoors(at(1, 0), 0, { ...far, coordinates: at(100, 0) }, []) === false)
}

report()
