import { expect, type Page, test } from "@playwright/test";

const visualViewports = [
  { id: "mobile-min", width: 320, height: 568 },
  { id: "mobile", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "compact-short", width: 1077, height: 609 },
  { id: "compact-content", width: 1280, height: 720 },
  { id: "desktop-boundary", width: 1280, height: 901 },
  { id: "desktop", width: 1440, height: 1000 },
] as const;

async function prepareVisualPage(page: Page) {
  await page.clock.install({ time: new Date("2026-08-03T12:00:00-03:00") });
  await page.route(/https:\/\/www\.google\.com\/maps\/embed.*/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const sections = page.locator("main section");
  for (let index = 0; index < (await sections.count()); index += 1) {
    await sections.nth(index).scrollIntoViewIfNeeded();
  }

  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((image) => {
        const styles = getComputedStyle(image);
        return (
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          image.getClientRects().length > 0
        );
      })
      .every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.locator("#inicio").scrollIntoViewIfNeeded();
}

test.describe("@visual landing snapshots", () => {
  for (const viewport of visualViewports) {
    test(`${viewport.id} full page`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareVisualPage(page);

      await expect(page).toHaveScreenshot(`${viewport.id}-full.png`, {
        fullPage: true,
        mask: [page.locator(".mat-studio__map")],
        maskColor: "#e1d6c7",
      });
    });
  }

  test("mobile class schedule disclosure", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareVisualPage(page);

    const classCard = page.locator("#clase-mat-pilates");
    await classCard.locator("summary").click();

    await expect(classCard).toHaveScreenshot("mobile-class-schedule-disclosure.png", {
      animations: "disabled",
    });
  });
});
