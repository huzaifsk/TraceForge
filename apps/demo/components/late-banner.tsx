"use client"

import { useEffect, useState } from "react"

/**
 * Two late arrivals with no reserved space, the way real pages go wrong: a promo
 * banner at 1 s, then a notice at 1.8 s. CLS adds up shifts that land within one
 * session window, so together they make a clearly poor score.
 */
export function LateBanner() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const timers = [setTimeout(() => setStage(1), 1_000), setTimeout(() => setStage(2), 1_800)]
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <>
      {stage >= 2 && (
        <div className="flex h-[30vh] items-center justify-center rounded-xl border bg-muted text-sm font-medium">
          We use cookies to make this shop worse. Accept?
        </div>
      )}
      {stage >= 1 && (
        <div className="flex h-[75vh] items-center justify-center rounded-xl bg-chart-1 text-lg font-semibold text-white">
          Surprise! A promo banner loaded late and pushed everything down.
        </div>
      )}
    </>
  )
}
