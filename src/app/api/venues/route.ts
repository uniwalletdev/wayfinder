import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"

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
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, address, city, country, lat, lng } = await req.json()
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const venue = await queryOne(
      `INSERT INTO venues (name, address, city, country, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, address ?? null, city ?? null, country ?? "UK", lat ?? null, lng ?? null]
    )
    return NextResponse.json(venue, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
