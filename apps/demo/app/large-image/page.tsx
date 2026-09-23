import Link from "next/link"

export default function LargeImagePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      {/* An unoptimized, late hero image: the Largest Contentful Paint of this page. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- deliberately not next/image */}
      <img
        src="/api/demo/slow-image?ms=4500"
        alt="A large hero image that loads slowly"
        width={1600}
        height={900}
        className="h-auto w-full rounded-xl border bg-muted"
      />
      <p className="text-sm text-muted-foreground">
        This image took about 4.5 s to arrive, so LCP is poor. Go{" "}
        <Link href="/" className="font-medium text-foreground underline underline-offset-4">
          back
        </Link>{" "}
        or switch tabs to send it.
      </p>
    </main>
  )
}
