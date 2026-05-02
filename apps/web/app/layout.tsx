import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "logokit · Brand lockup generator",
  description: "Upload a logo, type a name, export the lockup. Web, API, CLI.",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
