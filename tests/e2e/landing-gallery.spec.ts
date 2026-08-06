import { expect, test } from "@playwright/test";

import { openLanding } from "./support/landing";

test("gallery starts paused for reduced motion and remains keyboard operable", { tag: "@cross-browser" }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await gallery.press(" ");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
});

test("gallery supports swipe navigation without changing its pause state", { tag: "@cross-browser" }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  const track = gallery.locator(".mat-studio-gallery__track");
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute("data-studio-active-index", "0");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");

  const box = await gallery.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2, { steps: 6 });
    await expect
      .poll(() =>
        track.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
        }),
      )
      .toBeLessThan(-8);
  } finally {
    await page.mouse.up();
  }

  await expect(gallery).toHaveAttribute("data-studio-active-index", "1");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
});

test("gallery auto rotation keeps its leftward transform", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  const track = gallery.locator(".mat-studio-gallery__track");
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await expect(gallery).toHaveAttribute("data-studio-active-index", "1", { timeout: 7000 });
  await expect(gallery).toHaveAttribute("data-studio-animating", "false");

  const translateX = await track.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
  });

  expect(translateX).toBeLessThan(0);
});
