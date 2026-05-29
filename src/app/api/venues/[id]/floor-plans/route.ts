import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const plans = await query(
      `SELECT * FROM floor_plans WHERE venue_id = $1 ORDER BY floor`,
      [id]
    )
    return NextResponse.json(plans)
  } catch (error) {
    slog.error("api:floor-plans", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { floor, label, bounds } = body
    // Accept either a pre-formed URL or a base64 data URL uploaded directly
    const image_url: string | null = body.image_url ?? body.image_data ?? null

    if (floor == null || !label) {
      return NextResponse.json({ error: "floor and label are required" }, { status: 400 })
    }

    // Upsert: if a record for this venue+floor already exists, update it
    const plan = await queryOne(
      `INSERT INTO floor_plans (venue_id, floor, label, image_url, bounds)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (venue_id, floor) DO UPDATE
         SET label = EXCLUDED.label,
             image_url = EXCLUDED.image_url,
             bounds = EXCLUDED.bounds
       RETURNING *`,
      [id, floor, label, image_url, bounds ? JSON.stringify(bounds) : null]
    )
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    slog.error("api:floor-plans", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
