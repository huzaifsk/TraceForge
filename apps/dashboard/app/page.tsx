import { Button } from "@pulseed/ui/components/button"
import { ArrowRightIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/code-block"
import { Facts } from "@/components/landing/facts"
import { Features } from "@/components/landing/features"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Privacy } from "@/components/landing/privacy"
import { ProductShot } from "@/components/landing/product-shot"
import { GITHUB_URL, SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata: Metadata = {
  title: { absolute: "Pulseed — open-source frontend observability" },
  description:
    "See the JavaScript errors, failing API calls and slow pages your users hit in production. A 9 KB SDK, a real-time dashboard, open source.",
  openGraph: {
    title: "Pulseed — open-source frontend observability",
    description:
      "JavaScript errors, API failures and Core Web Vitals from real users, in a 9 KB SDK.",
    images: [{ url: "/landing/overview-light.png", width: 2880, height: 1800 }],
  },
}

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section
          aria-labelledby="hero-title"
          className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 pt-16 pb-12 text-center sm:pt-24 lg:px-6"
        >
          <a
            href={GITHUB_URL}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open source · MIT licensed
          </a>
          <div className="flex max-w-3xl flex-col gap-5">
            <h1
              id="hero-title"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
            >
              See what breaks for your users
            </h1>
            <p className="text-lg text-pretty text-muted-foreground">
              Pulseed catches the JavaScript errors, failing API calls and slow pages your users hit
              in production, groups them into issues, and shows you which ones matter.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
              Get started free
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<a href={GITHUB_URL} />}
            >
              Star on GitHub
            </Button>
          </div>
          <CodeBlock code="npm install @pulseed/sdk" className="w-full max-w-sm text-left" />
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
          <ProductShot />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-24 lg:px-6">
          <Facts />
          <Features />
          <HowItWorks />
          <Privacy />

          <section
            aria-labelledby="cta-title"
            className="flex flex-col items-center gap-6 rounded-2xl border bg-muted/40 px-6 py-16 text-center"
          >
            <h2
              id="cta-title"
              className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            >
              Find out what your users are running into
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Create a project, paste one line into your app, and see real sessions within minutes.
            </p>
            <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
              Get started free
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
