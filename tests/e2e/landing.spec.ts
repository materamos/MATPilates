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

test("navigation includes Horarios in the desktop bar, mobile menu, and footer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openLanding(page);

  const expectedLinks = [
    ["Hot Mat", "#hotmat"],
    ["Clases", "#clases"],
    ["Horarios", "#horarios"],
    ["El estudio", "#estudio"],
  ] as const;
  const desktopNavigation = page.getByRole("navigation", { name: "Navegación principal" });
  const footerNavigation = page.getByRole("navigation", { name: "Enlaces del pie de página" });

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

test("class cards derive their schedule summaries from the published week", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const matPilatesCard = page.locator("#clase-mat-pilates");
  await matPilatesCard.locator("summary").click();

  const scheduleDays = await matPilatesCard
    .locator(".mat-class-card__schedule-day")
    .evaluateAll((rows) =>
      rows.map((row) => ({
        day: row.querySelector("dt .sr-only")?.textContent,
        shortDay: row.querySelector('dt [aria-hidden="true"]')?.textContent,
        times: Array.from(row.querySelectorAll("time"), (time) => time.textContent),
      })),
    );

  expect(scheduleDays).toEqual([
    { day: "Lunes", shortDay: "Lun", times: ["08.00"] },
    { day: "Martes", shortDay: "Mar", times: ["08.00", "09.00"] },
    { day: "Miércoles", shortDay: "Mie", times: ["08.00"] },
    { day: "Jueves", shortDay: "Jue", times: ["08.00"] },
    { day: "Viernes", shortDay: "Vie", times: ["08.00", "16.00"] },
  ]);
  await expect(matPilatesCard.getByText("Horarios", { exact: true })).toBeVisible();
  await expect(
    matPilatesCard.getByRole("link", {
      name: "Ver horarios de MAT PILATES",
    }),
  ).toHaveAttribute("href", "#horarios");
  const ctaLayout = await matPilatesCard.locator(".mat-class-card__cta").evaluateAll((ctas) =>
    ctas.map((cta) => {
      const styles = getComputedStyle(cta);
      return {
        hasOverflow: cta.scrollWidth > cta.clientWidth,
        justifySelf: styles.justifySelf,
        whiteSpace: styles.whiteSpace,
        width: styles.width,
      };
    }),
  );
  expect(ctaLayout).toEqual([
    { hasOverflow: false, justifySelf: "center", whiteSpace: "nowrap", width: "256px" },
    { hasOverflow: false, justifySelf: "center", whiteSpace: "nowrap", width: "256px" },
  ]);

  const yogaCard = page.locator("#clase-yoga");
  await yogaCard.locator("summary").click();
  await expect(yogaCard.locator(".mat-class-card__schedule")).toHaveCount(0);
  await expect(yogaCard.locator(".mat-class-card__schedule-link")).toHaveCount(0);

  const occurrenceCounts = await page.evaluate(() => {
    const summaries = Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>(".mat-class-card"), (card) => [
        card.id.replace("clase-", ""),
        card.querySelectorAll(".mat-class-card__schedule-day time").length,
      ]),
    );
    const published: Record<string, number> = {};

    document
      .querySelectorAll<HTMLElement>(".mat-schedule__mobile [data-schedule-class]")
      .forEach((link) => {
        const classId = link.dataset.scheduleClass;

        if (classId) {
          published[classId] = (published[classId] ?? 0) + 1;
        }
      });

    return { published, summaries };
  });

  for (const [classId, summaryCount] of Object.entries(occurrenceCounts.summaries)) {
    expect(summaryCount).toBe(occurrenceCounts.published[classId] ?? 0);
  }
});

test("mobile class-to-schedule navigation opens, announces, and clears the selection", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-08-03T12:00:00-03:00") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const hotSculptCard = page.locator("#clase-hot-sculpt");
  await hotSculptCard.locator("summary").click();
  await page.evaluate(() => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      (window as Window & { matLastScrollBehavior?: ScrollBehavior }).matLastScrollBehavior =
        typeof options === "object" ? options.behavior : undefined;
      originalScrollIntoView.call(this, options);
    };
  });
  await hotSculptCard
    .getByRole("link", { name: "Ver horarios de HOT SCULPT" })
    .click();

  await expect(page).toHaveURL(/#horarios$/);
  await expect(page.locator(".mat-schedule-selection")).toContainText("Horarios de HOT SCULPT");

  const mobileSchedule = page.locator(".mat-schedule__mobile");
  const selectedLinks = mobileSchedule.locator(
    '[data-schedule-class="hot-sculpt"][data-schedule-selected="true"]',
  );
  const firstSelectedLink = selectedLinks.first();

  await expect(selectedLinks).toHaveCount(5);
  await expect(firstSelectedLink).toBeFocused();
  await expect(firstSelectedLink.locator("xpath=ancestor::details[1]")).toHaveAttribute("open", "");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { matLastScrollBehavior?: ScrollBehavior }).matLastScrollBehavior,
      ),
    )
    .toBe("auto");

  await page.getByRole("button", { name: "Ver todos" }).click();
  await expect(mobileSchedule.locator('[data-schedule-selected="true"]')).toHaveCount(0);
  await expect(page.locator(".mat-schedule-selection")).toHaveCount(0);
  await expect(page.locator("#horarios h2")).toBeFocused();
});

test("weekly schedule renders the confirmed data without duplicate day-time slots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const mobileSchedule = page.locator(".mat-schedule__mobile");
  const days = mobileSchedule.locator(".mat-schedule-day");
  const dayLabels = await days.locator("summary .mat-h3").allTextContents();
  const slotCounts = await days.evaluateAll((elements) =>
    elements.map((element) => element.querySelectorAll(".mat-schedule-day__slot").length),
  );

  expect(dayLabels).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]);
  expect(slotCounts).toEqual([12, 9, 9, 9, 9, 4]);
  await expect(mobileSchedule.locator(".mat-schedule__class-link")).toHaveCount(52);
  await expect(
    mobileSchedule.locator('.mat-schedule__class-link[class*="mat-schedule__class-link--"]'),
  ).toHaveCount(52);
  await expect(mobileSchedule.getByText("Yoga", { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 720 });
  const table = page.locator(".mat-schedule-table");
  const coordinates = await table.locator("tbody td").evaluateAll((cells) =>
    cells
      .filter((cell) => cell.querySelector(".mat-schedule__class-link"))
      .map((cell) => `${cell.getAttribute("data-schedule-day")}-${cell.getAttribute("data-schedule-time")}`),
  );

  await expect(table.locator("tbody tr")).toHaveCount(12);
  await expect(table.locator(".mat-schedule__class-link")).toHaveCount(52);
  expect(new Set(coordinates).size).toBe(52);
});

test("schedule reuses the catalog intensity colors and accessible labels", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLanding(page);

  const intensityStyles = await page.evaluate(() =>
    (["low", "moderate", "high"] as const).map((intensity) => {
      const chip = document.querySelector<HTMLElement>(
        `.mat-class-card__intensity--${intensity}`,
      )!;
      const scheduleLink = document.querySelector<HTMLElement>(
        `.mat-schedule__class-link--${intensity}`,
      )!;
      const chipStyles = getComputedStyle(chip);
      const scheduleStyles = getComputedStyle(scheduleLink);

      return {
        chip: {
          background: chipStyles.backgroundColor,
          color: chipStyles.color,
        },
        schedule: {
          background: scheduleStyles.backgroundColor,
          color: scheduleStyles.color,
        },
      };
    }),
  );

  for (const styles of intensityStyles) {
    expect(styles.schedule).toEqual(styles.chip);
  }

  await expect(page.locator(".mat-schedule__class-link--low").first()).toHaveAttribute(
    "aria-label",
    /intensidad baja/i,
  );
  await expect(page.locator(".mat-schedule__class-link--moderate").first()).toHaveAttribute(
    "aria-label",
    /intensidad moderada/i,
  );
  await expect(page.locator(".mat-schedule__class-link--high").first()).toHaveAttribute(
    "aria-label",
    /intensidad alta/i,
  );
});

test("intense desktop schedule links retain their hover cue", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLanding(page);

  const intenseLink = page.locator(".mat-schedule__desktop .mat-schedule__class-link--high").first();
  const restingBoxShadow = await intenseLink.evaluate((link) => getComputedStyle(link).boxShadow);

  await intenseLink.hover();
  await expect
    .poll(() => intenseLink.evaluate((link) => getComputedStyle(link).boxShadow))
    .toContain("2px");
  await expect(intenseLink).not.toHaveCSS("box-shadow", restingBoxShadow);
});

test("schedule accordions are exclusive and class links reveal their catalog card", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-08-03T12:00:00-03:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const days = page.locator(".mat-schedule__mobile .mat-schedule-day");
  await expect(days.nth(0)).toHaveAttribute("open", "");
  await expect(days.nth(1)).not.toHaveAttribute("open", "");

  await days.nth(1).locator("summary").click();
  await expect(days.nth(0)).not.toHaveAttribute("open", "");
  await expect(days.nth(1)).toHaveAttribute("open", "");

  await days.nth(1).locator(".mat-schedule__class-link").first().click();
  const classCard = page.locator("#clase-mat-pilates");

  await expect(page).toHaveURL(/#clase-mat-pilates$/);
  await expect(classCard).toHaveAttribute("open", "");
  await expect(classCard.locator("summary")).toBeFocused();
});

test("desktop class-to-schedule selection preserves the reverse catalog link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLanding(page);

  const matPilatesCard = page.locator("#clase-mat-pilates");
  await matPilatesCard.locator("summary").click();
  await matPilatesCard
    .getByRole("link", { name: "Ver horarios de MAT PILATES" })
    .click();

  const selectedLinks = page.locator(
    '.mat-schedule__desktop [data-schedule-class="mat-pilates"][data-schedule-selected="true"]',
  );

  await expect(selectedLinks).toHaveCount(7);
  await expect(selectedLinks.first()).toBeFocused();
  await selectedLinks.first().click();

  await expect(page).toHaveURL(/#clase-mat-pilates$/);
  await expect(matPilatesCard).toHaveAttribute("open", "");
  await expect(matPilatesCard.locator("summary")).toBeFocused();
  await expect(page.locator(".mat-schedule-selection")).toHaveCount(0);
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
