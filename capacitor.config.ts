import type { CapacitorConfig } from "@capacitor/cli"

// Native Android and iOS apps for Findway.
//
// The apps carry the interface inside them. `npm run mobile:build` makes a
// static export of the pages into out/ (scripts/app-shell-build.mjs), and
// `cap sync` copies that into both native projects. Only /api is remote, on the
// deployment named by FINDWAY_API_URL at build time. So the app opens straight
// onto the map, works on first launch with no signal for every venue it ships
// with, and asks for location, camera and motion through the system's own
// prompts with the reasons in Info.plist and AndroidManifest.xml.
//
// Capacitor's local file server hands every extensionless path to index.html,
// which is why the app's root page is the navigation screen (src/app/page.tsx).
const config: CapacitorConfig = {
  appId: "ai.findway.app",
  appName: "Findway",
  webDir: "out",
  backgroundColor: "#0A1626",
  plugins: {
    // With the keyboard up, the web view shrinks to the space above it, so the
    // search box and its results stay in view instead of the page being pushed
    // up and left there after the keyboard closes.
    Keyboard: { resize: "native", resizeOnFullScreen: true },
  },
  ios: {
    contentInset: "never",
    // Pinch-zoom belongs to the map, not the page.
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
}

export default config
