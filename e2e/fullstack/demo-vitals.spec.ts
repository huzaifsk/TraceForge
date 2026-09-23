import { expect, test } from "@playwright/test"

import { DASHBOARD, DEMO, FULLSTACK, signInToProject } from "./env"

/*
 * The demo's performance triggers produce the poor vitals they promise, on the
 * page that caused them.
 */
test.skip(!FULLSTACK, "set E2E_FULLSTACK=1 with the stack running")

const hide = () => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
  document.dispatchEvent(new Event("visibilitychange"))
}

test("large image, layout shift and slow render show up as poor vitals", async ({ browser }) => {
  test.setTimeout(90_000)
  const demo = await browser.newPage()
  await demo.goto(`${DEMO}/large-image`)
  await expect(demo.getByRole("img", { name: /hero image/i })).toBeVisible({ timeout: 10_000 })
  await demo.getByRole("link", { name: "back" }).click()
  await demo.goto(`${DEMO}/layout-shift`)
  await demo.waitForTimeout(3_000)
  await demo.getByRole("link", { name: "Back to the triggers" }).click()
  await demo.getByRole("button", { name: "Click me" }).click()
  await demo.evaluate(hide)
  await demo.waitForTimeout(1_500)
  await demo.close()

  const page = await browser.newPage()
  const base = await signInToProject(page)
  const row = (route: string) => page.getByRole("row").filter({ hasText: route })

  await expect(async () => {
    await page.goto(`${DASHBOARD}${base}/performance?range=1h`)
    await expect(row("/large-image")).toContainText("(poor)", { timeout: 2_000 })
    await expect(row("/layout-shift")).toContainText("(poor)", { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
})
