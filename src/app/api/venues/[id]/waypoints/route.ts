import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

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
    slog.error("api:waypoints", error)
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
    slog.error("api:waypoints", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { waypointId, name, type, floor, lat, lng, description } = await req.json()
    if (!waypointId) return NextResponse.json({ error: "waypointId required" }, { status: 400 })

    const updated = await queryOne(
      `UPDATE waypoints SET
         name        = COALESCE($1, name),
         type        = COALESCE($2, type),
         floor       = COALESCE($3, floor),
         lat         = COALESCE($4, lat),
         lng         = COALESCE($5, lng),
         description = COALESCE($6, description)
       WHERE id = $7 AND venue_id = $8
       RETURNING *`,
      [name ?? null, type ?? null, floor ?? null, lat ?? null, lng ?? null, description ?? null, waypointId, id]
    )
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    slog.error("api:waypoints", error)
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
    slog.error("api:waypoints", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
