import { defineConfig, devices } from "@playwright/test";

type PlaywrightConfigOptions = {
  fullCrossBrowser?: boolean;
};

const port = 3218;
const baseURL = `http://127.0.0.1:${port}`;

export function createPlaywrightConfig({
  fullCrossBrowser = false,
}: PlaywrightConfigOptions = {}) {
  const criticalOnly = fullCrossBrowser ? {} : { grep: /@cross-browser/ };

  return defineConfig({
    testDir: "./tests/e2e",
    outputDir: "test-results",
    snapshotPathTemplate:
      "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
    fullyParallel: false,
    retries: 0,
    workers: process.env.CI ? 1 : 4,
    reporter: [
      ["list"],
      ["html", { open: "never", outputFolder: "playwright-report" }],
    ],
    expect: {
      toHaveScreenshot: {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.0002,
        scale: "css",
        threshold: 0.15,
      },
    },
    use: {
      baseURL,
      colorScheme: "light",
      contextOptions: {
        reducedMotion: "reduce",
      },
      locale: "es-AR",
      screenshot: "only-on-failure",
      timezoneId: "America/Argentina/Buenos_Aires",
      trace: "retain-on-failure",
      video: "retain-on-failure",
    },
    webServer: {
      command: "npm run test:e2e:serve",
      url: baseURL,
      reuseExistingServer: false,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 180_000,
    },
    projects: [
      {
        name: "chromium",
        testIgnore: /\.dpr2\.spec\.ts/,
        use: {
          ...devices["Desktop Chrome"],
          deviceScaleFactor: 1,
          viewport: { width: 1280, height: 720 },
        },
      },
      {
        name: "chromium-dpr2",
        testMatch: /\.dpr2\.spec\.ts/,
        use: {
          ...devices["Desktop Chrome"],
          deviceScaleFactor: 2,
          viewport: { width: 390, height: 844 },
        },
      },
      {
        name: "firefox",
        ...criticalOnly,
        grepInvert: /@visual/,
        testIgnore: /\.dpr2\.spec\.ts/,
        use: {
          ...devices["Desktop Firefox"],
          viewport: { width: 1280, height: 720 },
        },
      },
      {
        name: "webkit",
        ...criticalOnly,
        grepInvert: /@visual/,
        testIgnore: /\.dpr2\.spec\.ts/,
        use: {
          ...devices["Desktop Safari"],
          viewport: { width: 1280, height: 720 },
        },
      },
    ],
  });
}
