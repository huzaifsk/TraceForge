import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { DASHBOARD, FULLSTACK, signInToProject } from "./env"

/*
 * Every dashboard screen, in both themes: no console errors or warnings
 * (including hydration mismatches) and no WCAG 2.2 AA violations.
 */
test.skip(!FULLSTACK, "set E2E_FULLSTACK=1 with the stack running")

const SCREENS = [
  "/overview?range=7d",
  "/issues?range=7d",
  "/performance?range=7d",
  "/api?range=7d",
  "/live",
  "/settings",
]

for (const colorScheme of ["light", "dark"] as const) {
  test(`every screen is clean and accessible (${colorScheme})`, async ({ browser }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext({
      colorScheme,
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()
    const problems: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`${page.url()} [${message.type()}] ${message.text()}`)
      }
    })
    page.on("pageerror", (error) => problems.push(`${page.url()} [pageerror] ${error.message}`))

    const audit = async (label: string) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      for (const v of violations) problems.push(`${label} [axe:${v.impact}] ${v.id}: ${v.help}`)
    }

    await page.goto(`${DASHBOARD}/`)
    await audit("landing")
    await page.goto(`${DASHBOARD}/login`)
    await audit("login")
    const base = await signInToProject(page)
    await audit("projects")

    for (const screen of SCREENS) {
      await page.goto(`${DASHBOARD}${base}${screen}`)
      await page.waitForLoadState("networkidle")
      await audit(screen)
    }
    await page.goto(`${DASHBOARD}${base}/issues?range=7d`)
    await page.locator("[data-row-link]").first().click()
    await page.waitForLoadState("networkidle")
    await audit("issue detail")

    expect(problems).toEqual([])
    await context.close()
  })
}

test("global filters stay usable on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const base = await signInToProject(page)
  await page.goto(`${DASHBOARD}${base}/overview`)
  await page
    .getByRole("radio", { name: "Last 7d" })
    .or(page.getByRole("button", { name: "Last 7d" }))
    .first()
    .click()
  await expect(page).toHaveURL(/range=7d/)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
  await context.close()
})

test("the ⌘K command menu opens, is accessible, and navigates", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const base = await signInToProject(page)
  await page.goto(`${DASHBOARD}${base}/overview`)

  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include("[role=dialog]").analyze()
  expect(violations.map((v) => v.id)).toEqual([])

  await page.keyboard.type("issues")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/issues/)
  expect(errors).toEqual([])
})
