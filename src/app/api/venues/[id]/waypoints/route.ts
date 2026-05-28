import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const waypoints = await query(
      `SELECT * FROM waypoints WHERE venue_id = $1 ORDER BY floor, name`,
      [id]
    )
    return NextResponse.json(waypoints)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { floor, name, type, lat, lng, description, qr_code } = await req.json()

    if (!name || !type || lat == null || lng == null || floor == null) {
      return NextResponse.json({ error: "floor, name, type, lat, lng are required" }, { status: 400 })
    }

    const waypoint = await queryOne(
      `INSERT INTO waypoints (venue_id, floor, name, type, lat, lng, description, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, floor, name, type, lat, lng, description ?? null, qr_code ?? null]
    )
    return NextResponse.json(waypoint, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const waypointId = searchParams.get("waypointId")
    if (!waypointId) return NextResponse.json({ error: "waypointId required" }, { status: 400 })

    await query(
      `DELETE FROM waypoints WHERE id = $1 AND venue_id = $2`,
      [waypointId, id]
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
