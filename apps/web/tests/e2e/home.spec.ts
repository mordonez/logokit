import { expect, test } from "@playwright/test"

const fixturePath = new URL("../fixtures/sample-logo.svg", import.meta.url)

test("generates a preview and downloads svg", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible()
  await expect(page.getByAltText("Generated logo preview")).toBeVisible({ timeout: 15000 })

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(fixturePath.pathname)

  await page.getByLabel("Primary text").fill("Northwind")
  await page.getByLabel("Secondary text").fill("Platform")
  await page.getByRole("radio", { name: /Vertical/i }).check({ force: true })

  await page.getByRole("button", { name: /download svg/i }).click({ force: true })
  await expect(page.getByText("SVG ready.")).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/download failed/i)).toHaveCount(0)
})
