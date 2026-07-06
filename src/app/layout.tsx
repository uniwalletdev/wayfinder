import type { Metadata, Viewport } from "next"
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google"
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${spaceGrotesk.variable} ${ibmPlexSans.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
