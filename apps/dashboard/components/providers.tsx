"use client"

import { Toaster } from "@traceforge/ui/components/sonner"
import { TooltipProvider } from "@traceforge/ui/components/tooltip"

import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delay={400}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
