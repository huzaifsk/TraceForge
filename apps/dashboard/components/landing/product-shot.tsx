import Image from "next/image"

import darkShot from "@/public/landing/overview-dark.png"
import lightShot from "@/public/landing/overview-light.png"

/** The real dashboard, in whichever theme the visitor is using. */
export function ProductShot() {
  const className = "h-auto w-full rounded-xl"
  const alt =
    "The Pulseed overview: error, API failure and user counts, Core Web Vitals, an error trend chart and the top issues"
  return (
    <div className="rounded-2xl border bg-muted/40 p-1.5 shadow-2xl shadow-foreground/5 sm:p-2">
      <Image
        src={lightShot}
        alt={alt}
        priority
        placeholder="blur"
        sizes="(min-width: 1152px) 1120px, 100vw"
        className={`${className} dark:hidden`}
      />
      <Image
        src={darkShot}
        alt={alt}
        priority
        placeholder="blur"
        sizes="(min-width: 1152px) 1120px, 100vw"
        className={`${className} hidden dark:block`}
      />
    </div>
  )
}
