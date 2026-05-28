import { NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const venue = await queryOne(
      `SELECT v.*,
        (SELECT COUNT(*) FROM waypoints w WHERE w.venue_id = v.id) AS waypoint_count
       FROM venues v WHERE v.id = $1`,
      [id]
    )
    if (!venue) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json(venue)
  } catch (error) {
    slog.error("api:venue", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
