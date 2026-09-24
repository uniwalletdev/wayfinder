import type { CapacitorConfig } from "@capacitor/cli"

// Native Android and iOS shells for Wayfinder.
//
// Wayfinder is a server-rendered Next.js app: API routes (directions, geocoding,
// the Claude-backed survey), Clerk sign-in and Postgres all run on the server,
// so it cannot be exported as static files and bundled into the app. The shells
// load the deployed site instead — the same way the installed PWA does — and
// add what a browser tab cannot: a home-screen app with its own icon, store
// distribution, and native permission prompts for location, camera and motion.
//
// WAYFINDER_URL is read when `npx cap sync` runs and baked into the native
// project, so set it before syncing (CI takes it from a repository variable).
// Without it the shell opens mobile/www, which explains how to point it at a
// deployment rather than showing a blank screen.
const serverUrl = process.env.WAYFINDER_URL?.trim()

const config: CapacitorConfig = {
  appId: "app.wayfinder.nav",
  appName: "Wayfinder",
  webDir: "mobile/www",
  backgroundColor: "#0A1626",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          // Only the deployment itself. Clerk's hosted sign-in and Mapbox are
          // reached by the page as ordinary network requests, not navigations.
          allowNavigation: [new URL(serverUrl).hostname],
          // Never downgrade: a hospital's guest Wi-Fi is exactly where a
          // plaintext page would be tampered with.
          cleartext: false,
          errorPath: "offline.html",
        },
      }
    : {}),
  ios: {
    contentInset: "never",
    // Pinch-zoom belongs to the map, not the page.
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
}

export default config
