import { expect, type Locator, test } from "@playwright/test";

import { openLanding } from "./support/landing";

async function expectDisclosureSettled(disclosure: Locator, open: boolean) {
  await expect
    .poll(
      () =>
        disclosure.evaluate((element) => {
          const expansion = element.querySelector<HTMLElement>(".mat-disclosure__expansion");
          const body = element.querySelector<HTMLElement>(".mat-disclosure__body");

          if (!expansion || !body) {
            return null;
          }

          const bodyStyles = getComputedStyle(body);
          const expansionStyles = getComputedStyle(expansion);
          const translateY =
            bodyStyles.transform === "none"
              ? 0
              : new DOMMatrixReadOnly(bodyStyles.transform).m42;

          return {
            hasHeight: expansion.getBoundingClientRect().height > 1,
            isClosing: element.getAttribute("data-closing") === "true",
            isContentVisible:
              element.hasAttribute("open") && expansionStyles.visibility === "visible",
            isOpaque: Number.parseFloat(bodyStyles.opacity) >= 0.999,
            isOpen: element.hasAttribute("open"),
            pointerEvents: expansionStyles.pointerEvents,
            translateY: Math.round(translateY),
          };
        }),
      { timeout: 2500 },
    )
    .toEqual({
      hasHeight: open,
      isClosing: false,
      isContentVisible: open,
      isOpaque: open,
      isOpen: open,
      pointerEvents: open ? "auto" : "none",
      translateY: open ? 0 : -4,
    });
}


async function activateDisclosureSummary(disclosure: Locator) {
  await disclosure.locator("summary").evaluate((summary) => {
    (summary as HTMLElement).click();
  });
}

async function readDisclosureMotion(disclosure: Locator) {
  return disclosure.evaluate((element) => {
    const summary = element.querySelector<HTMLElement>(".mat-disclosure__summary")!;
    const indicator = element.querySelector<HTMLElement>(".mat-disclosure__indicator")!;
    const expansion = element.querySelector<HTMLElement>(".mat-disclosure__expansion")!;
    const body = element.querySelector<HTMLElement>(".mat-disclosure__body")!;

    return {
      bodyDuration: getComputedStyle(body).transitionDuration,
      expansionDuration: getComputedStyle(expansion).transitionDuration,
      indicatorDuration: getComputedStyle(indicator, "::before").transitionDuration,
      summaryDuration: getComputedStyle(summary).transitionDuration,
    };
  });
}

function expectDisclosureDuration(
  motion: Awaited<ReturnType<typeof readDisclosureMotion>>,
  duration: string,
) {
  expect(motion.bodyDuration.split(",").every((value) => value.trim() === duration)).toBe(true);
  expect(motion.expansionDuration.split(",")[0].trim()).toBe(duration);
  expect(motion.indicatorDuration).toBe(duration);
  expect(motion.summaryDuration).toBe(duration);
}

async function expectDisclosureTransition(
  disclosure: Locator,
  action: () => Promise<void>,
  closing: boolean,
) {
  const transitionStarted = disclosure.evaluate(
    (element, expectedClosing) =>
      new Promise<{ isClosing: boolean; isOpen: boolean } | null>((resolve) => {
        const readState = () => ({
          isClosing: element.dataset.closing === "true",
          isOpen: (element as HTMLDetailsElement).open,
        });
        const finish = (state: { isClosing: boolean; isOpen: boolean } | null) => {
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve(state);
        };
        const observeState = () => {
          const state = readState();

          if (state.isOpen && state.isClosing === expectedClosing) {
            finish(state);
          }
        };
        const observer = new MutationObserver(observeState);
        const timeout = window.setTimeout(() => finish(null), 1000);

        observer.observe(element, {
          attributeFilter: ["data-closing", "open"],
          attributes: true,
        });
        observeState();
      }),
    closing,
  );

  await action();
  expect(await transitionStarted).toEqual({ isClosing: closing, isOpen: true });
}

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

test("class and schedule disclosures use intrinsic motion without clipping", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 1024, width: 768 },
    { height: 768, width: 1023 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const runtimeErrors = await openLanding(page);
    expect(runtimeErrors).toEqual([]);

    const classCard = page.locator("#clase-mat-pilates");
    const scheduleDay = page.locator(".mat-schedule__mobile .mat-schedule-day").last();
    const classSummary = classCard.locator("summary");
    const scheduleSummary = scheduleDay.locator("summary");

    await expect(classCard).not.toHaveAttribute("open", "");
    expectDisclosureDuration(await readDisclosureMotion(classCard), "0.24s");
    await expectDisclosureTransition(classCard, () => classSummary.press("Enter"), false);
    await expectDisclosureSettled(classCard, true);
    expectDisclosureDuration(await readDisclosureMotion(classCard), "0.32s");

    const classGeometry = await classCard.locator(".mat-disclosure__body").evaluate((body) => ({
      horizontalOverflow: body.scrollWidth - body.clientWidth,
      verticalOverflow: body.scrollHeight - body.clientHeight,
    }));
    expect(classGeometry.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(classGeometry.verticalOverflow).toBeLessThanOrEqual(1);

    await expectDisclosureTransition(classCard, () => classSummary.press("Space"), true);
    await expectDisclosureSettled(classCard, false);

    await expectDisclosureTransition(classCard, () => classSummary.press("Enter"), false);
    await expectDisclosureSettled(classCard, true);
    await expectDisclosureTransition(classCard, () => classSummary.press("Space"), true);
    await expectDisclosureSettled(classCard, false);

    await expectDisclosureTransition(scheduleDay, () => scheduleSummary.press("Enter"), false);
    await expectDisclosureSettled(scheduleDay, true);
    expectDisclosureDuration(await readDisclosureMotion(scheduleDay), "0.32s");

    const scheduleGeometry = await scheduleDay
      .locator(".mat-disclosure__body")
      .evaluate((body) => ({
        horizontalOverflow: body.scrollWidth - body.clientWidth,
        verticalOverflow: body.scrollHeight - body.clientHeight,
      }));
    expect(scheduleGeometry.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(scheduleGeometry.verticalOverflow).toBeLessThanOrEqual(1);

    await expectDisclosureTransition(scheduleDay, () => scheduleSummary.press("Space"), true);
    await expectDisclosureSettled(scheduleDay, false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("reduced motion makes class and schedule disclosure changes instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 1024, width: 768 },
    { height: 768, width: 1023 },
  ]) {
    await page.setViewportSize(viewport);
    const runtimeErrors = await openLanding(page);
    expect(runtimeErrors).toEqual([]);

    const classCard = page.locator("#clase-mat-pilates");
    const scheduleDay = page.locator(".mat-schedule__mobile .mat-schedule-day").last();

    expectDisclosureDuration(await readDisclosureMotion(classCard), "0s");
    await classCard.locator("summary").click();
    await expectDisclosureSettled(classCard, true);
    expectDisclosureDuration(await readDisclosureMotion(classCard), "0s");
    await classCard.locator("summary").click();
    await expectDisclosureSettled(classCard, false);

    await scheduleDay.locator("summary").click();
    await expectDisclosureSettled(scheduleDay, true);
    expectDisclosureDuration(await readDisclosureMotion(scheduleDay), "0s");
    await scheduleDay.locator("summary").click();
    await expectDisclosureSettled(scheduleDay, false);
  }
});

test("rapid disclosure changes preserve exclusivity and hide closed content", { tag: "@cross-browser" }, async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-09T12:00:00-03:00"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const cards = page.locator(".mat-class-card");
  await activateDisclosureSummary(cards.nth(0));
  await activateDisclosureSummary(cards.nth(1));
  await expect(cards.nth(0)).not.toHaveAttribute("open", "");
  await expect(cards.nth(1)).toHaveAttribute("open", "");
  await expectDisclosureSettled(cards.nth(0), false);
  await expectDisclosureSettled(cards.nth(1), true);

  const closedCardFocusResults = await cards
    .nth(0)
    .locator(".mat-disclosure__body a, .mat-disclosure__body button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        (element as HTMLElement).focus();
        return document.activeElement === element;
      }),
    );
  expect(closedCardFocusResults.every((isFocused) => !isFocused)).toBe(true);

  const days = page.locator(".mat-schedule__mobile .mat-schedule-day");
  await activateDisclosureSummary(days.nth(1));
  await activateDisclosureSummary(days.nth(2));
  await expect(days.nth(1)).not.toHaveAttribute("open", "");
  await expect(days.nth(2)).toHaveAttribute("open", "");
  await expectDisclosureSettled(days.nth(1), false);
  await expectDisclosureSettled(days.nth(2), true);

  await activateDisclosureSummary(days.nth(1));
  await expect(days.nth(2)).toHaveAttribute("data-closing", "true");
  await activateDisclosureSummary(days.nth(2));
  await expectDisclosureSettled(days.nth(1), false);
  await expectDisclosureSettled(days.nth(2), true);

  const closedDayFocusResults = await days
    .nth(1)
    .locator(".mat-disclosure__body a, .mat-disclosure__body button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        (element as HTMLElement).focus();
        return document.activeElement === element;
      }),
    );
  expect(closedDayFocusResults.every((isFocused) => !isFocused)).toBe(true);
});

test("class and schedule links remain usable during disclosure transitions", { tag: "@cross-browser" }, async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const classCard = page.locator("#clase-mat-pilates");
  await classCard.locator("summary").click();
  const classScheduleLink = classCard.getByRole("link", {
    name: "Ver horarios de MAT PILATES",
  });
  await classScheduleLink.focus();
  await classScheduleLink.press("Enter");

  await expect(page).toHaveURL(/#horarios$/);
  const scheduleLink = page.locator(
    '.mat-schedule__mobile [data-schedule-class="mat-pilates"]',
  ).first();
  await expect(scheduleLink).toBeFocused();
  await scheduleLink.press("Enter");

  await expect(page).toHaveURL(/#clase-mat-pilates$/);
  await expect(classCard).toHaveAttribute("open", "");
  await expect(classCard.locator("summary")).toBeFocused();
});
