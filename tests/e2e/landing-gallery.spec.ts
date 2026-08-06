import { expect, test, type Locator, type Page } from "@playwright/test";

import { openLanding } from "./support/landing";

async function startTransformSampling(track: Locator) {
  await track.evaluate((element) => {
    const galleryWindow = window as typeof window & {
      __studioGalleryFrame?: number;
      __studioGallerySamples?: number[];
    };

    galleryWindow.__studioGallerySamples = [];

    const sampleTransform = () => {
      const transform = getComputedStyle(element).transform;
      const translateX =
        transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;

      galleryWindow.__studioGallerySamples?.push(translateX);
      galleryWindow.__studioGalleryFrame = requestAnimationFrame(sampleTransform);
    };

    sampleTransform();
  });
}

async function startSlideTransformSampling(gallery: Locator, imageIndex: number) {
  await gallery.evaluate((element, index) => {
    const galleryWindow = window as typeof window & {
      __studioGalleryFrame?: number;
      __studioGallerySamples?: number[];
    };

    galleryWindow.__studioGallerySamples = [];

    const sampleTransform = () => {
      const slide = element.querySelector<HTMLElement>(
        `.mat-studio-gallery__slide[data-studio-image-index="${index}"]`,
      );

      if (slide) {
        const transform = getComputedStyle(slide).transform;
        const translateX =
          transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;

        galleryWindow.__studioGallerySamples?.push(translateX);
      }

      galleryWindow.__studioGalleryFrame = requestAnimationFrame(sampleTransform);
    };

    sampleTransform();
  }, imageIndex);
}

async function stopTransformSampling(track: Locator) {
  return track.evaluate(() => {
    const galleryWindow = window as typeof window & {
      __studioGalleryFrame?: number;
      __studioGallerySamples?: number[];
    };

    if (galleryWindow.__studioGalleryFrame !== undefined) {
      cancelAnimationFrame(galleryWindow.__studioGalleryFrame);
    }

    return galleryWindow.__studioGallerySamples ?? [];
  });
}

async function swipeLeft(page: Page, gallery: Locator, track: Locator) {
  const box = await gallery.boundingBox();
  const previousIndex = await gallery.getAttribute("data-studio-active-index");
  expect(box).not.toBeNull();
  expect(previousIndex).not.toBeNull();

  const activeSlide = gallery.locator(
    `.mat-studio-gallery__slide[data-studio-image-index="${previousIndex}"]`,
  );
  const initialSlideBox = await activeSlide.boundingBox();
  expect(initialSlideBox).not.toBeNull();

  await startTransformSampling(track);
  await page.mouse.move(
    box!.x + box!.width * 0.75,
    box!.y + box!.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      box!.x + box!.width * 0.25,
      box!.y + box!.height / 2,
      { steps: 6 },
    );
    await expect
      .poll(async () => (await activeSlide.boundingBox())?.x ?? 0)
      .toBeLessThan(initialSlideBox!.x - 8);
  } finally {
    await page.mouse.up();
  }

  await expect
    .poll(() => gallery.getAttribute("data-studio-active-index"))
    .not.toBe(previousIndex);
  await expect(gallery).toHaveAttribute("data-studio-animating", "false");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  const samples = await stopTransformSampling(track);
  const largestFrameDelta = samples.slice(1).reduce((largestDelta, value, index) => {
    return Math.max(largestDelta, Math.abs(value - samples[index]));
  }, 0);

  return { galleryWidth: box!.width, largestFrameDelta };
}

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
  const activeSlide = gallery.locator(".mat-studio-gallery__slide");
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
        activeSlide.evaluate((element) => {
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

test("gallery completes consecutive swipe cycles without a visible wrap jump", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  const track = gallery.locator(".mat-studio-gallery__track");
  await gallery.scrollIntoViewIfNeeded();
  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "true");

  for (const expectedIndex of [1, 0, 1, 0]) {
    const { galleryWidth, largestFrameDelta } = await swipeLeft(
      page,
      gallery,
      track,
    );

    await expect(gallery).toHaveAttribute(
      "data-studio-active-index",
      String(expectedIndex),
    );
    expect(largestFrameDelta).toBeLessThan(galleryWidth / 2);
  }
});

test("gallery auto rotation keeps its leftward transform", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await startSlideTransformSampling(gallery, 0);
  await expect(gallery).toHaveAttribute("data-studio-active-index", "1", {
    timeout: 7000,
  });
  await expect(gallery).toHaveAttribute("data-studio-animating", "false");
  const samples = await stopTransformSampling(gallery);

  expect(Math.min(...samples)).toBeLessThan(-8);
});
