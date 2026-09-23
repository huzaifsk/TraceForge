const MAX_DELAY_MS = 8_000

/**
 * A large hero image that arrives late, so it becomes a poor Largest Contentful
 * Paint. Generated on the fly: no binary assets in the repo.
 */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("ms"))
  const ms = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), MAX_DELAY_MS) : 4_500
  await new Promise((resolve) => setTimeout(resolve, ms))
  return new Response(heroSvg(ms), {
    headers: { "content-type": "image/svg+xml", "cache-control": "no-store" },
  })
}

/**
 * A detailed mosaic. Chrome ignores low-detail images as LCP candidates (under
 * ~0.05 bits per pixel), so a flat gradient would never count as the LCP.
 */
function heroSvg(ms: number): string {
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const tiles: string[] = []
  for (let y = 0; y < 900; y += 30) {
    for (let x = 0; x < 1600; x += 30) {
      const hue = Math.round(200 + random() * 60)
      const light = Math.round(35 + random() * 30)
      tiles.push(
        `<rect x="${x}" y="${y}" width="30" height="30" fill="hsl(${hue} 70% ${light}%)"/>`
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
${tiles.join("")}
<text x="800" y="470" font-family="system-ui, sans-serif" font-size="64" fill="#fff" text-anchor="middle">Hero image, ${ms} ms late</text>
</svg>`
}
