import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@traceforge/ui/globals.css"
import { cn } from "@traceforge/ui/lib/utils"

import { Toaster } from "@traceforge/ui/components/sonner"

import { DemoHeader } from "@/components/demo-header"
import { ThemeProvider } from "@/components/theme-provider"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "TraceForge Demo",
  description: "An intentionally broken app that shows TraceForge catching real failures.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased", fontSans.variable, fontMono.variable)}
    >
      {/* Browser extensions (password managers, Grammarly, colour pickers) add attributes to <body>
          before React loads; this silences only mismatches in body's own attributes. */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          <DemoHeader />
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
