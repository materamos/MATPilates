import { expect, type Page, test } from "@playwright/test";

import { openLanding } from "./support/landing";

type ViewportCase = {
  height: number;
  id: string;
  mapVisible: boolean;
  navigation: "desktop" | "mobile";
  width: number;
};

const viewportCases: readonly ViewportCase[] = [
  { id: "mobile-min", width: 320, height: 568, navigation: "mobile", mapVisible: false },
  { id: "mobile", width: 390, height: 844, navigation: "mobile", mapVisible: false },
  {
    id: "tablet-landscape",
    width: 812,
    height: 375,
    navigation: "mobile",
    mapVisible: false,
  },
  { id: "tablet-min", width: 768, height: 1024, navigation: "mobile", mapVisible: false },
  { id: "tablet-max", width: 1023, height: 768, navigation: "mobile", mapVisible: true },
  { id: "compact-min", width: 1024, height: 768, navigation: "desktop", mapVisible: true },
  {
    id: "compact-short",
    width: 1077,
    height: 609,
    navigation: "desktop",
    mapVisible: true,
  },
  {
    id: "compact-max",
    width: 1279,
    height: 820,
    navigation: "desktop",
    mapVisible: true,
  },
  {
    id: "compact-content",
    width: 1280,
    height: 720,
    navigation: "desktop",
    mapVisible: true,
  },
  {
    id: "desktop-boundary",
    width: 1280,
    height: 901,
    navigation: "desktop",
    mapVisible: true,
  },
  { id: "desktop", width: 1440, height: 1000, navigation: "desktop", mapVisible: true },
] as const;

async function loadVisualContent(page: Page) {
  const sections = page.locator("main section");

  for (let index = 0; index < (await sections.count()); index += 1) {
    await sections.nth(index).scrollIntoViewIfNeeded();
  }

  await page.locator("#inicio").scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

test.describe("responsive contract", () => {
  test("tablet portrait Hot Mat ends 32 px after its closing copy", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const runtimeErrors = await openLanding(page);
    await loadVisualContent(page);

    const layout = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>(".mat-hot-mat")!;
      const closing = document.querySelector<HTMLElement>(".mat-hot-mat__closing")!;
      const sectionRect = section.getBoundingClientRect();
      const closingRect = closing.getBoundingClientRect();

      return {
        bottomSpace: sectionRect.bottom - closingRect.bottom,
        sectionHeight: sectionRect.height,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layout.bottomSpace).toBeCloseTo(32, 0);
    expect(layout.sectionHeight).toBeLessThan(layout.viewportHeight);
    expect(runtimeErrors).toEqual([]);
  });

  for (const viewportCase of viewportCases) {
    test(`${viewportCase.id} has intrinsic sections and no document overflow`, async ({ page }) => {
      await page.setViewportSize({
        width: viewportCase.width,
        height: viewportCase.height,
      });
      const runtimeErrors = await openLanding(page);
      await loadVisualContent(page);

      const layout = await page.evaluate(() => {
        const documentElement = document.documentElement;
        const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section"));
        const classes = document.querySelector<HTMLElement>(".mat-classes")!;
        const schedule = document.querySelector<HTMLElement>(".mat-schedule")!;
        const reservation = document.querySelector<HTMLElement>(".mat-reservation")!;
        const classesStyles = getComputedStyle(classes);
        const scheduleStyles = getComputedStyle(schedule);
        const reservationStyles = getComputedStyle(reservation);

        return {
          clientWidth: documentElement.clientWidth,
          scrollWidth: documentElement.scrollWidth,
          classesInset: {
            bottom: Number.parseFloat(classesStyles.paddingBottom),
            top: Number.parseFloat(classesStyles.paddingTop),
          },
          scheduleInset: {
            bottom: Number.parseFloat(scheduleStyles.paddingBottom),
            top: Number.parseFloat(scheduleStyles.paddingTop),
          },
          reservationInset: {
            bottom: Number.parseFloat(reservationStyles.paddingBottom),
            top: Number.parseFloat(reservationStyles.paddingTop),
          },
          clippedSections: sections
            .filter(
              (section) =>
                !section.classList.contains("mat-manifesto") &&
                section.scrollWidth > section.clientWidth + 1,
            )
            .map((section) => section.id || section.className),
        };
      });

      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.clippedSections).toEqual([]);
      const expectedSectionInset = viewportCase.width >= 1024 ? 60 : 32;

      expect(layout.classesInset).toEqual({
        bottom: expectedSectionInset,
        top: expectedSectionInset,
      });
      expect(layout.scheduleInset).toEqual({
        bottom: expectedSectionInset,
        top: expectedSectionInset,
      });
      expect(layout.reservationInset).toEqual({
        bottom: expectedSectionInset,
        top: expectedSectionInset,
      });

      if (viewportCase.navigation === "desktop") {
        const reservationContentInset = await page.evaluate(() => {
          const section = document.querySelector<HTMLElement>(".mat-reservation")!;
          const copy = document.querySelector<HTMLElement>(".mat-reservation__copy")!;
          const image = document.querySelector<HTMLElement>(".mat-reservation__image")!;
          const sectionRect = section.getBoundingClientRect();
          const contentTop = Math.min(
            copy.getBoundingClientRect().top,
            image.getBoundingClientRect().top,
          );
          const contentBottom = Math.max(
            copy.getBoundingClientRect().bottom,
            image.getBoundingClientRect().bottom,
          );

          return {
            bottom: sectionRect.bottom - contentBottom,
            top: contentTop - sectionRect.top,
          };
        });

        expect(reservationContentInset.top).toBeCloseTo(expectedSectionInset, 0);
        expect(reservationContentInset.bottom).toBeCloseTo(expectedSectionInset, 0);
      }

      const mobileMenuButton = page.getByRole("button", { name: "Abrir menú" });
      const desktopNavigation = page.getByRole("navigation", { name: "Navegación principal" });

      if (viewportCase.navigation === "mobile") {
        await expect(mobileMenuButton).toBeVisible();
        await expect(desktopNavigation).toBeHidden();
        await expect(page.locator(".mat-schedule__mobile")).toBeVisible();
        await expect(page.locator(".mat-schedule__desktop")).toBeHidden();
      } else {
        await expect(mobileMenuButton).toBeHidden();
        await expect(desktopNavigation).toBeVisible();
        await expect(page.locator(".mat-schedule__mobile")).toBeHidden();
        await expect(page.locator(".mat-schedule__desktop")).toBeVisible();
      }

      const map = page.locator(".mat-studio__map");
      if (viewportCase.mapVisible) {
        await expect(map).toBeVisible();
      } else {
        await expect(map).toBeHidden();
      }

      expect(runtimeErrors).toEqual([]);
    });
  }
});

test("focus outline follows the documented token", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const primaryAction = page.getByRole("link", { name: "Elegí tu experiencia" });
  await primaryAction.focus();

  await expect
    .poll(() =>
      primaryAction.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          offset: styles.outlineOffset,
          style: styles.outlineStyle,
          width: styles.outlineWidth,
        };
      }),
    )
    .toEqual({ offset: "4px", style: "solid", width: "2px" });
});
