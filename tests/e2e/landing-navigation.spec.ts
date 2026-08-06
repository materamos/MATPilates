import { expect, test } from "@playwright/test";

import { openLanding } from "./support/landing";

const mobileMenuDestinations = [
  { name: "Hot Mat", href: "#hotmat" },
  { name: "Clases", href: "#clases" },
  { name: "Horarios", href: "#horarios" },
  { name: "El Estudio", href: "#estudio" },
  { name: "Conocé cómo sumarte", href: "#contacto" },
] as const;

test("mobile menu restores focus when dismissed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  await menuButton.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(menuButton).toBeFocused();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`mobile menu scrolls every internal destination with ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 390, height: 844 });
    await openLanding(page);

    for (const destination of mobileMenuDestinations) {
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page
        .locator("#mobile-navigation")
        .getByRole("link", { name: destination.name, exact: true })
        .click();

      const section = page.locator(destination.href);
      await expect(page).toHaveURL(new RegExp(`${destination.href}$`));
      await expect(page.locator("#mobile-navigation")).toHaveCount(0);
      await expect(page.locator("main")).not.toHaveAttribute("inert", "");
      await expect(section.locator("h2")).toBeFocused();
      await expect
        .poll(() =>
          section.evaluate((element) => {
            const header = document.querySelector<HTMLElement>(".site-header");
            const sectionTop = element.getBoundingClientRect().top;
            const headerBottom = header?.getBoundingClientRect().bottom ?? 0;

            return {
              isBelowHeader: sectionTop >= headerBottom - 1,
              isVisible: sectionTop < window.innerHeight,
              moved: window.scrollY > 0,
            };
          }),
        )
        .toEqual({ isBelowHeader: true, isVisible: true, moved: true });
    }
  });
}

test("mobile menu keeps the background inert through its Motion exit", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const main = page.locator("main");
  const menu = page.locator("#mobile-navigation");
  const menuButton = page.getByRole("button", { name: "Abrir menú" });

  await menuButton.click();
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(main).toHaveAttribute("inert", "");
  await page.evaluate(() => {
    const mainElement = document.querySelector<HTMLElement>("main")!;
    const testWindow = window as typeof window & {
      __menuPresentWhenInertReleased?: boolean;
    };
    const observer = new MutationObserver(() => {
      if (!mainElement.hasAttribute("inert")) {
        testWindow.__menuPresentWhenInertReleased = Boolean(
          document.querySelector("#mobile-navigation"),
        );
        observer.disconnect();
      }
    });

    observer.observe(mainElement, { attributeFilter: ["inert"], attributes: true });
  });

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(main).not.toHaveAttribute("inert", "");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __menuPresentWhenInertReleased?: boolean })
            .__menuPresentWhenInertReleased,
      ),
    )
    .toBe(false);
  await expect(menuButton).toBeFocused();
});

test(
  "navigation includes Horarios in the desktop bar, mobile menu, and footer",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const runtimeErrors = await openLanding(page);

    const expectedLinks = [
      ["Hot Mat", "#hotmat"],
      ["Clases", "#clases"],
      ["Horarios", "#horarios"],
      ["El estudio", "#estudio"],
    ] as const;
    const desktopNavigation = page.getByRole("navigation", { name: "Navegación principal" });
    const footerNavigation = page.getByRole("navigation", {
      name: "Enlaces del pie de página",
    });

    for (const [name, href] of expectedLinks) {
      await expect(desktopNavigation.getByRole("link", { name })).toHaveAttribute("href", href);
      await expect(footerNavigation.getByRole("link", { name })).toHaveAttribute("href", href);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir menú" }).click();

    const mobileNavigation = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNavigation.getByRole("link", { name: "Horarios" })).toHaveAttribute(
      "href",
      "#horarios",
    );
    expect(runtimeErrors).toEqual([]);
  },
);
