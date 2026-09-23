import Link from "next/link"

export default function OrdersPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Client-side navigations are recorded as navigation events.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {[123, 456].map((id) => (
          <li key={id}>
            <Link href={`/orders/${id}`} className="underline underline-offset-4">
              Order #{id}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
