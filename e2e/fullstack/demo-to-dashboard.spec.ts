/*
 * The whole loop, end to end: a real browser breaks things in the demo app, the
 * real SDK reports them, the API ingests them, and the dashboard shows them.
 *
 * Needs the stack running and seeded (see README "Testing"):
 *   E2E_FULLSTACK=1 DASHBOARD_URL=http://localhost:3000 DEMO_URL=http://localhost:3001 pnpm e2e
 */
import { expect, test } from "@playwright/test"

import { DEMO, FULLSTACK, signInToProject } from "./env"

test.skip(!FULLSTACK, "set E2E_FULLSTACK=1 with the stack running")

test("a failure triggered in the demo shows up in the dashboard", async ({ browser }) => {
  test.setTimeout(90_000)

  // 1. Break things in the demo.
  const demo = await browser.newPage()
  await demo.goto(DEMO)
  await expect(demo.getByRole("heading", { name: "Break things on purpose" })).toBeVisible()
  await demo.getByRole("button", { name: "Call API" }).first().click() // Trigger API error
  await demo.getByRole("button", { name: "Throw" }).click() // Trigger JS error
  await expect(demo.getByText("GET /api/demo/orders → 500").first()).toBeVisible()
  await expect(
    demo.getByText(/TypeError: Cannot read properties of undefined/).first()
  ).toBeVisible()
  await demo.waitForTimeout(1_500) // one flush interval
  await demo.close()

  // 2. See them in the dashboard.
  const page = await browser.newPage()
  const base = await signInToProject(page)
  const issuesUrl = `${new URL(page.url()).origin}${base}/issues?range=1h`
  await expect(async () => {
    await page.goto(issuesUrl)
    await expect(page.getByRole("link", { name: /GET \/api\/demo\/orders → 500/ })).toBeVisible({
      timeout: 2_000,
    })
    await expect(
      page.getByRole("link", {
        name: /TypeError: Cannot read properties of undefined \(reading 'items'\)/,
      })
    ).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  // 3. The issue detail shows where it happened.
  await page
    .getByRole("link", {
      name: /TypeError: Cannot read properties of undefined \(reading 'items'\)/,
    })
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TypeError")
  await expect(page.getByText("Chrome").first()).toBeVisible()
})
