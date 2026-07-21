import type { NextConfig } from "next";

// Security response headers.
//
// The motivating risk is specific to this app: Wayfinder asks for **camera and
// geolocation** (Survey Mode, the compass overlay, the blue dot). With no frame
// protection, a hostile page could embed Wayfinder in an invisible iframe and
// overlay decoy UI so a click intended for something else lands on a permission
// prompt, or on a venue delete. Framing is the header that matters most here.
//
// DELIBERATELY NOT SET: a full Content-Security-Policy (`script-src`,
// `style-src`, `connect-src`). This app loads Clerk from its own domains, Leaflet
// from the bundle, and Mapbox tiles at runtime, and Next.js injects inline
// styles and scripts. A source-list CSP written without being able to exercise
// every one of those against a live deployment is far more likely to break
// sign-in or the map than to stop an attack — and it would fail *silently*, in
// production, on a healthcare app. `frame-ancestors` below is the one CSP
// directive that restricts nothing except embedding, so it is safe to ship on
// its own. A full policy is worth doing later, in report-only mode first.
const securityHeaders = [
  // Clickjacking. Both forms: frame-ancestors is the modern one and wins where
  // supported, X-Frame-Options covers older browsers that ignore it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
