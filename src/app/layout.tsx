import type { Metadata, Viewport } from "next"
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
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

export const metadata: Metadata = {
  title: "Wayfinder — NHS hospitals, mapped",
  description:
    "Wayfinder maps NHS hospitals floor by floor and guides patients, visitors and staff from the front door to the right ward, clinic or bedside — one clear step at a time.",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
