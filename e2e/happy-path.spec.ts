import { test, expect } from "@playwright/test";

test.skip("coach marks attendance, admin sees it", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/אקדמיית סנוקר/);
});
