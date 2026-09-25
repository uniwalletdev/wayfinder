import type { NextConfig } from "next";

// Security response headers.
//
// The motivating risk is specific to this app: Wayfinder asks for **camera and
// geolocation** (Survey Mode, the compass overlay, the blue dot). With no frame
// protection, a hostile page could embed Wayfinder in an invisible iframe and
// overlay decoy UI so a click intended for something else lands on a permission
// prompt, or on a venue delete. Framing is the header that matters most here.
//
// DELIBERATELY NOT ENFORCED: a full Content-Security-Policy (`script-src`,
// `style-src`, `connect-src`). This app loads Clerk from its own domains, Leaflet
// from the bundle, and map tiles at runtime, and Next.js injects inline styles
// and scripts. A source-list CSP written without being able to exercise every
// one of those against a live deployment is far more likely to break sign-in or
// the map than to stop an attack — and it would fail *silently*, in production,
// on a healthcare app. `frame-ancestors` below is the one CSP directive that
// restricts nothing except embedding, so it is enforced on its own.
//
// The full policy ships in REPORT-ONLY mode instead: browsers apply nothing but
// tell /api/csp-report what they would have blocked. Once a deployment's log
// has been quiet through sign-in, the map, plan upload and the camera tools,
// move the value below to a `Content-Security-Policy` header. Expect to add
// a deployment's own Clerk domain (accounts.<your-domain>) to script-src,
// connect-src and frame-src first.
const reportOnlyPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; Clerk and its bot check load from
  // their own domains.
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
  // Tailwind's generated stylesheet is self-hosted; Leaflet and next/font set
  // inline styles.
  "style-src 'self' 'unsafe-inline'",
  // Street tiles, floor plans (data: URLs for uploaded plans), QR codes (data:),
  // Clerk avatars.
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.basemaps.cartocdn.com",
  // The pdf.js worker is bundled and run from a blob.
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com https://*.clerk.accounts.dev",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ")

const securityHeaders = [
  // Clickjacking. Both forms: frame-ancestors is the modern one and wins where
  // supported, X-Frame-Options covers older browsers that ignore it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy },
  { key: "X-Frame-Options", value: "DENY" },

  // Don't let the browser second-guess a declared Content-Type — an uploaded
  // floor plan served as an image must never be sniffed as HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Venue ids appear in URLs, and unlisted/private venues are reachable by id.
  // Sending only the origin cross-origin keeps those ids out of other sites'
  // logs when someone follows an outbound link.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Allow the two capabilities the app genuinely uses, from this origin only,
  // and refuse to delegate them to any embedded frame. Everything else is off.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "geolocation=(self)",
      "accelerometer=(self)",
      "gyroscope=(self)",
      "magnetometer=(self)",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },

  // Browsers ignore HSTS on localhost, so this is inert in development.
  // No `preload` and no `includeSubDomains`: both are hard to reverse, and
  // subdomains here are not known to be HTTPS-only.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Nothing needs to advertise the framework in a response header.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // /api/footprints reads data/footprints.geojson at runtime with fs, rather
  // than importing it — the national collection of OpenStreetMap hospital
  // outlines is far too large to bundle for the one site a user is looking at.
  // Nothing statically references the file, so file tracing can't infer it and
  // the route would find nothing in production while working fine locally.
  outputFileTracingIncludes: {
    "/api/footprints": ["./data/footprints.geojson"],
  },
};

export default nextConfig;
