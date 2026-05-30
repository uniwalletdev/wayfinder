import { NextResponse } from "next/server"

interface SurveyPayload {
  frames: Array<{
    timestamp: number
    coordinates: { lat: number; lng: number }
    heading: number
    floor: number
    annotation?: string
    imageData?: string
  }>
  sessionId: string
  submittedAt: string
}

// In-memory store for survey submissions (replace with a database in production).
// Each entry strips imageData to save memory; a real backend would persist the images.
const surveyLog: Array<Omit<SurveyPayload, "frames"> & { frameCount: number; annotatedCount: number }> = []

export async function POST(request: Request) {
  let body: SurveyPayload

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    return NextResponse.json({ error: "frames array is required" }, { status: 400 })
  }

  const annotated = body.frames.filter((f) => f.annotation).length
  const waypoints = body.frames
    .filter((f) => f.annotation)
    .map((f) => ({ annotation: f.annotation, coordinates: f.coordinates, floor: f.floor }))

  surveyLog.push({
    sessionId: body.sessionId ?? crypto.randomUUID(),
    submittedAt: body.submittedAt ?? new Date().toISOString(),
    frameCount: body.frames.length,
    annotatedCount: annotated,
  })

  // Log to server console so operators can see new mapping submissions
  console.log(
    `[survey] New submission: ${body.frames.length} frames, ${annotated} annotated waypoints`,
    waypoints
  )

  return NextResponse.json({
    success: true,
    received: body.frames.length,
    annotated,
    message: `Thank you! ${body.frames.length} frames received. Your mapping helps others navigate this area.`,
  })
}

// Allow listing recent submissions (admin/debug use)
export async function GET() {
  return NextResponse.json({ submissions: surveyLog.slice(-20) })
}
