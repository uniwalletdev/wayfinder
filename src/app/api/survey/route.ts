import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { venue_id, frames } = body

    if (!venue_id || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "venue_id and frames[] are required" }, { status: 400 })
    }

    // Batch insert all frames
    const inserted = await Promise.all(
      frames.map((f) =>
        queryOne(
          `INSERT INTO survey_frames
             (venue_id, floor, lat, lng, heading, annotation, image_data, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            venue_id,
            f.floor ?? 0,
            f.coordinates?.lat ?? null,
            f.coordinates?.lng ?? null,
            f.heading ?? null,
            f.annotation ?? null,
            f.imageData ?? null,
            new Date(f.timestamp),
          ]
        )
      )
    )

    return NextResponse.json({ ok: true, saved: inserted.length }, { status: 201 })
  } catch (error) {
    slog.error("api:survey", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const venue_id = searchParams.get("venue_id")
    const floor = searchParams.get("floor")

    if (!venue_id) return NextResponse.json({ error: "venue_id required" }, { status: 400 })

    const frames = await query(
      `SELECT id, floor, lat, lng, heading, annotation, captured_at
       FROM survey_frames
       WHERE venue_id = $1 ${floor ? "AND floor = $2" : ""}
       ORDER BY captured_at DESC
       LIMIT 500`,
      floor ? [venue_id, floor] : [venue_id]
    )
    return NextResponse.json(frames)
  } catch (error) {
    slog.error("api:survey", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
