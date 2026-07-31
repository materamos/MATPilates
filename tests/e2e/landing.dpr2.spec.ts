import { expect, test } from "@playwright/test";

test("@visual DPR 2 preserves mobile media and class rendering", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>(".mat-hero img, .mat-class-card:first-child img"))
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

  await expect(page.locator(".mat-hero")).toHaveScreenshot("mobile-hero-dpr2.png");
  await expect(page.locator(".mat-class-card").first()).toHaveScreenshot(
    "mobile-class-card-dpr2.png",
  );
});
