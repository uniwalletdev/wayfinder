import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { venue_id, points } = body

    if (!venue_id || !Array.isArray(points) || points.length === 0) {
      return NextResponse.json({ error: "venue_id and points[] required" }, { status: 400 })
    }

    const inserted = await Promise.all(
      points.map((p) =>
        queryOne(
          `INSERT INTO gps_traces (venue_id, lat, lng, heading, accuracy, floor, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            venue_id,
            p.lat,
            p.lng,
            p.heading ?? null,
            p.accuracy ?? null,
            p.floor ?? 0,
            new Date(p.timestamp),
          ]
        )
      )
    )

    return NextResponse.json({ ok: true, saved: inserted.length }, { status: 201 })
  } catch (error) {
    slog.error("api:traces", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const venue_id = searchParams.get("venue_id")
    const floor = searchParams.get("floor")

    if (!venue_id) return NextResponse.json({ error: "venue_id required" }, { status: 400 })

    const traces = await query(
      `SELECT lat, lng, heading, floor, captured_at
       FROM gps_traces
       WHERE venue_id = $1 ${floor ? "AND floor = $2" : ""}
       ORDER BY captured_at DESC
       LIMIT 2000`,
      floor ? [venue_id, floor] : [venue_id]
    )

    return NextResponse.json(traces)
  } catch (error) {
    slog.error("api:traces", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
