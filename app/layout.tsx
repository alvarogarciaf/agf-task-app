import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/sonner"
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
  title: "TASKER AGF",
  description:
    "Zero-latency, offline-first task manager. Capture, process, and ship work at the speed of local hardware.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TASKER AGF",
  },
  icons: {
    icon: "/logo.svg?v=3",
    apple: "/logo-pwa.svg?v=3",
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
  userScalable: true,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
        <ServiceWorkerRegister />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
