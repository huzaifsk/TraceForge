import Link from "next/link"

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight">Order #{id}</h1>
      <p className="text-sm text-muted-foreground">
        In the dashboard this route is grouped as <code className="font-mono">/orders/:id</code>.
      </p>
      <Link href="/orders" className="text-sm underline underline-offset-4">
        All orders
      </Link>
    </main>
  )
}
