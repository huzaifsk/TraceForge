import type { Page } from "@playwright/test"

/** Full-stack suites need the API, dashboard and demo running, and `pnpm db:seed`. */
export const FULLSTACK = !!process.env.E2E_FULLSTACK
export const DASHBOARD = process.env.DASHBOARD_URL ?? "http://localhost:3000"
export const DEMO = process.env.DEMO_URL ?? "http://localhost:3001"
export const EMAIL = process.env.E2E_EMAIL ?? "demo@traceforge.local"
export const PASSWORD = process.env.E2E_PASSWORD ?? "correct-horse-battery"

/** Sign in and open the seeded project; returns its base path (/p/tf_…). */
export async function signInToProject(page: Page): Promise<string> {
  await page.goto(`${DASHBOARD}/login`)
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("**/projects")
  const href = await page.getByRole("link", { name: /Acme Storefront/ }).getAttribute("href")
  return href!.replace(/\/overview$/, "")
}
