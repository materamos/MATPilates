import { expect, test } from "@playwright/test";

import { openLanding } from "./support/landing";

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

test(
  "mobile class-to-schedule navigation opens, announces, and clears the selection",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
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
    await expect(firstSelectedLink.locator("xpath=ancestor::details[1]")).toHaveAttribute(
      "open",
      "",
    );
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
  },
);

test(
  "weekly schedule renders the confirmed data without duplicate day-time slots",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runtimeErrors = await openLanding(page);

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
        .map(
          (cell) =>
            `${cell.getAttribute("data-schedule-day")}-${cell.getAttribute("data-schedule-time")}`,
        ),
    );

    await expect(table.locator("tbody tr")).toHaveCount(12);
    await expect(table.locator(".mat-schedule__class-link")).toHaveCount(52);
    expect(new Set(coordinates).size).toBe(52);
    expect(runtimeErrors).toEqual([]);
  },
);

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
  await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
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
