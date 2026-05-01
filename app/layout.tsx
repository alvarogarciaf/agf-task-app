import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Velocity — Local-first task manager",
  description:
    "Zero-latency, offline-first task manager. Capture, process, and ship work at the speed of local hardware.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
  userScalable: true,
}

import { DbProvider } from "@/components/db-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <DbProvider>
          {children}
        </DbProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
