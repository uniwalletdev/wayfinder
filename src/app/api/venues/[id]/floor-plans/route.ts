import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"

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
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { floor, label, image_url, bounds } = await req.json()

    if (floor == null || !label) {
      return NextResponse.json({ error: "floor and label are required" }, { status: 400 })
    }

    const plan = await queryOne(
      `INSERT INTO floor_plans (venue_id, floor, label, image_url, bounds)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [id, floor, label, image_url ?? null, bounds ? JSON.stringify(bounds) : null]
    )
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
