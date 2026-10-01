import type { Metadata, Viewport } from "next"
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import { siteUrl } from "@/lib/site-url"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
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
