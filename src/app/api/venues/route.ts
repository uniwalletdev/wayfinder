import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { slog } from "@/lib/logger"

// Columns that were added after the initial `venues` table shipped. If a
// deployment's DB predates them, an INSERT fails with "column ... does not
// exist". Rather than require a manual /api/db-init run, we add any missing
// columns on demand and retry the insert once.
const VENUE_COLUMN_DEFS: Record<string, string> = {
  lat: "DOUBLE PRECISION",
  lng: "DOUBLE PRECISION",
  floors: "INTEGER DEFAULT 1",
  venue_type: "TEXT",
  is_private: "BOOLEAN DEFAULT FALSE",
}

async function ensureVenueColumns() {
  const statements = Object.entries(VENUE_COLUMN_DEFS)
    .map(([col, def]) => `ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col} ${def};`)
    .join("\n")
  await query(statements)
}

function isMissingColumnError(error: unknown): boolean {
  // pg error code 42703 = undefined_column
  const code = (error as { code?: string })?.code
  if (code === "42703") return true
  return /column .* of relation "venues" does not exist/i.test(String(error))
}

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

    const insert = () =>
      queryOne(
        `INSERT INTO venues (name, address, city, country, lat, lng, floors, venue_type, is_private)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [name, address ?? null, city ?? null, country ?? "UK", lat ?? null, lng ?? null, floors ?? 1, venue_type ?? null, is_private ?? false]
      )

    let venue
    try {
      venue = await insert()
    } catch (error) {
      if (!isMissingColumnError(error)) throw error
      // Self-heal: the DB is missing a recently-added column. Add it and retry.
      slog.warn("api:venues", "venues table missing columns — running ensureVenueColumns", { error: String(error) })
      await ensureVenueColumns()
      venue = await insert()
    }
    return NextResponse.json(venue, { status: 201 })
  } catch (error) {
    slog.error("api:venues", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
