import { expect, type Page, test } from "@playwright/test";

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

async function openLanding(page: Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.route(/https:\/\/www\.google\.com\/maps\/embed.*/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  return runtimeErrors;
}

async function loadVisualContent(page: Page) {
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

test.describe("responsive contract", () => {
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

        return {
          clientWidth: documentElement.clientWidth,
          scrollWidth: documentElement.scrollWidth,
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

      const mobileMenuButton = page.getByRole("button", { name: "Abrir menú" });
      const desktopNavigation = page.getByRole("navigation", { name: "Navegación principal" });

      if (viewportCase.navigation === "mobile") {
        await expect(mobileMenuButton).toBeVisible();
        await expect(desktopNavigation).toBeHidden();
      } else {
        await expect(mobileMenuButton).toBeHidden();
        await expect(desktopNavigation).toBeVisible();
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

test("mobile menu restores and transfers focus correctly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  await menuButton.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("link", {
    name: /Hot Mat/,
  }).click();
  await expect(page).toHaveURL(/#hotmat$/);
  await expect(page.locator("#hotmat h2")).toBeFocused();
});

test("class cards keep a single disclosure open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const cards = page.locator(".mat-class-card");
  await cards.nth(0).locator("summary").click();
  await expect(cards.nth(0)).toHaveAttribute("open", "");

  await cards.nth(1).locator("summary").click();
  await expect(cards.nth(0)).not.toHaveAttribute("open", "");
  await expect(cards.nth(1)).toHaveAttribute("open", "");
});

test("gallery starts paused for reduced motion and remains keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await gallery.press(" ");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
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
