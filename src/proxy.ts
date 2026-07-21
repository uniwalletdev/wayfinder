// Clerk auth wiring. In Next.js 16 this file is "Proxy" — the rename of what
// earlier versions called Middleware (see node_modules/next/dist/docs/01-app/
// 01-getting-started/16-proxy.md). Same functionality, new filename.
//
// Two deliberate choices here, both about not breaking navigation:
//
// 1. Clerk is OPTIONAL. Without a publishable key this file is a pass-through,
//    exactly like the Mapbox and Anthropic integrations elsewhere in the app: a
//    deployment with no key quietly loses sign-in, it does not error. Wayfinder
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
// Both apply to Wayfinder as a whole, not to any one venue: a single account
// spans every mapped place (GOSH is just one of ~17 that ship today), and
// `/navigate` serves all of them.

import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default clerkEnabled ? clerkMiddleware() : () => NextResponse.next()

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
