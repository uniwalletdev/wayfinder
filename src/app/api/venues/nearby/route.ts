import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { slog } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get("lat") ?? "")
    const lng = parseFloat(searchParams.get("lng") ?? "")
    const radius = parseFloat(searchParams.get("radius") ?? "500")

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 })
    }

    // Use stored lat/lng on venues table, fall back to average of waypoints
    const venues = await query(`
      SELECT
        v.*,
        COALESCE(v.lat, AVG(w.lat)) AS center_lat,
        COALESCE(v.lng, AVG(w.lng)) AS center_lng,
        COUNT(DISTINCT w.id)  AS waypoint_count,
        COUNT(DISTINCT fp.id) AS floor_count,
        ROUND(
          6371000 * 2 * ASIN(SQRT(
            POWER(SIN((RADIANS(COALESCE(v.lat, AVG(w.lat))) - RADIANS($1)) / 2), 2) +
            COS(RADIANS($1)) * COS(RADIANS(COALESCE(v.lat, AVG(w.lat)))) *
            POWER(SIN((RADIANS(COALESCE(v.lng, AVG(w.lng))) - RADIANS($2)) / 2), 2)
          ))
        ) AS distance_m
      FROM venues v
      LEFT JOIN waypoints w  ON w.venue_id  = v.id
      LEFT JOIN floor_plans fp ON fp.venue_id = v.id
      GROUP BY v.id
      HAVING
        COALESCE(v.lat, AVG(w.lat)) IS NOT NULL
        AND 6371000 * 2 * ASIN(SQRT(
              POWER(SIN((RADIANS(COALESCE(v.lat, AVG(w.lat))) - RADIANS($1)) / 2), 2) +
              COS(RADIANS($1)) * COS(RADIANS(COALESCE(v.lat, AVG(w.lat)))) *
              POWER(SIN((RADIANS(COALESCE(v.lng, AVG(w.lng))) - RADIANS($2)) / 2), 2)
            )) <= $3
      ORDER BY distance_m ASC
      LIMIT 20
    `, [lat, lng, radius])

    return NextResponse.json(venues)
  } catch (error) {
    slog.error("api:nearby", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
