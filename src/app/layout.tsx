import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { ClerkProvider } from "@clerk/nextjs"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import { siteUrl } from "@/lib/site-url"
import "./globals.css"

// The two typefaces ship in the repo (src/app/fonts) rather than coming from
// next/font/google. That variant downloads the files from Google at build time,
// and the download fails often enough on CI to take an app build down with it.
// Both files are Google's own latin-subset variable fonts, covering weights
// 400 to 700; the unicode-range matches what Google's stylesheet declares, so
// other scripts fall through to the system font exactly as before. The range
// is written out twice because next/font only accepts literal values.

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  weight: "400 700",
  variable: "--font-heading",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
})

const ibmPlexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
})

const DESCRIPTION =
  "Findway maps NHS hospitals floor by floor and guides patients, visitors and staff from the front door to the right ward, clinic or bedside — one clear step at a time."

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "Findway — NHS hospitals, mapped",
    template: "%s · Findway",
  },
  description: DESCRIPTION,
  applicationName: "Findway",
  manifest: "/manifest.json",
  // A shared link — a ward sent to a relative, a poster's URL — unfurls with
  // the app's name and purpose rather than a bare address.
  openGraph: {
    type: "website",
    siteName: "Findway",
    title: "Findway — NHS hospitals, mapped",
    description: DESCRIPTION,
    locale: "en_GB",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Findway" }],
  },
  twitter: {
    card: "summary",
    title: "Findway — NHS hospitals, mapped",
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Findway", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Page zoom stays on (WCAG 1.4.4). The map does not need it switched off:
  // Leaflet sets touch-action: none on its container, so a pinch there zooms
  // the map rather than the page.
  themeColor: "#0A1626",
  viewportFit: "cover",
}

// Sign-in is optional and additive: it exists to carry saved places and venue
// ownership across devices, never to stand between someone and a route. So when
// no Clerk publishable key is configured the provider is left out entirely and
// the app renders exactly as it always has — the same "no key → feature quietly
// off" contract the Mapbox and Anthropic integrations follow.
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${spaceGrotesk.variable} ${ibmPlexSans.variable}`}>
      <body className="h-full">
        <ServiceWorkerRegistrar />
        {clerkEnabled ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  )
}
