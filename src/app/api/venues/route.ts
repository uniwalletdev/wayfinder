import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function GET() {
  try {
    const venues = await query(`
      SELECT v.*,
        COUNT(DISTINCT w.id) AS waypoint_count,
        COUNT(DISTINCT fp.id) AS floor_count
      FROM venues v
      LEFT JOIN waypoints w ON w.venue_id = v.id
      LEFT JOIN floor_plans fp ON fp.venue_id = v.id
      GROUP BY v.id
      ORDER BY v.name
    `)
    return NextResponse.json(venues)
  } catch (error) {
    slog.error("api:venues", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, address, city, country, lat, lng, floors, venue_type, is_private } = await req.json()
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const venue = await queryOne(
      `INSERT INTO venues (name, address, city, country, lat, lng, floors, venue_type, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, address ?? null, city ?? null, country ?? "UK", lat ?? null, lng ?? null, floors ?? 1, venue_type ?? null, is_private ?? false]
    )
    return NextResponse.json(venue, { status: 201 })
  } catch (error) {
    slog.error("api:venues", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
