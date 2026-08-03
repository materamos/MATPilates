import { expect, type Page, test } from "@playwright/test";

async function openLanding(page: Page) {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
}

test("schedule opens the current day and falls back to Monday on Sunday", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-04T12:00:00-03:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const days = page.locator(".mat-schedule__mobile .mat-schedule-day");
  await expect(days.nth(0)).not.toHaveAttribute("open", "");
  await expect(days.nth(1)).toHaveAttribute("open", "");

  await page.clock.setFixedTime(new Date("2026-08-09T12:00:00-03:00"));
  await page.reload();

  await expect(days.nth(0)).toHaveAttribute("open", "");
  await expect(days.nth(1)).not.toHaveAttribute("open", "");
});
