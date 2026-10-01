// Clerk auth wiring and the API's cross-origin policy. In Next.js 16 this file
// is "Proxy" — the rename of what earlier versions called Middleware (see
// node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
//
// Two deliberate choices about not breaking navigation:
//
// 1. Clerk is OPTIONAL. Without a publishable key this file is a pass-through,
//    exactly like the Mapbox and Anthropic integrations elsewhere in the app: a
//    deployment with no key quietly loses sign-in, it does not error. Findway
//    has always run with zero backend config (localStorage-only) and must keep
//    doing so.
//
// 2. `/navigate` is EXCLUDED from the matcher. That is the wayfinding route
//    people use inside a building, frequently with no signal. clerkMiddleware()
//    on its own does not protect anything — routes are only gated when you call
//    auth.protect() — but keeping the core journey off the auth path entirely
//    means a Clerk outage, an expired key or a misconfigured deployment can
//    never stop someone finding a ward. `/map` stays matched, because venue
//    ownership genuinely wants to know who you are.
//
// Both apply to Findway as a whole, not to any one venue: a single account
// spans every mapped place, and `/navigate` serves all of them.
//
// 3. The Android and iOS apps carry the interface and call /api from their own
//    origins: WKWebView's capacitor://localhost and Android's https://localhost.
//    Browsers treat that as cross-origin, so /api answers their preflights and
//    labels its responses for exactly those origins. Credentials are never
//    allowed through: nothing in the apps signs in, and reflecting an origin
//    with cookies would let any page served from someone's own localhost act as
//    the signed-in user. Without credentials the headers grant nothing a curl
//    command could not already do.

import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server"

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const APP_ORIGINS = new Set(["capacitor://localhost", "https://localhost", "ionic://localhost"])

function appOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin")
  return origin && APP_ORIGINS.has(origin) && req.nextUrl.pathname.startsWith("/api/") ? origin : null
}

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = appOrigin(req)
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin)
    res.headers.append("Vary", "Origin")
  }
  return res
}

const handler: NextMiddleware = clerkEnabled
  ? clerkMiddleware((_auth, req) => withCors(req, NextResponse.next()))
  : (req) => withCors(req, NextResponse.next())

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const origin = appOrigin(req)
  if (origin && req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    })
  }
  return handler(req, event)
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets, and /navigate.
    // Note `.svg` is in the asset list, so every venue's floor plans are served
    // without touching auth.
    "/((?!_next|navigate|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
}
