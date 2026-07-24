import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "plugin"), { recursive: true });

await build({
  entryPoints: [resolve(root, "server/src/index.ts")],
  outfile: resolve(dist, "server/index.js"),
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: true,
});

await build({
  entryPoints: [resolve(root, "plugin/src/main.ts")],
  outfile: resolve(dist, "plugin/code.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
});

await build({
  entryPoints: [resolve(root, "plugin/src/ui.ts")],
  outfile: resolve(dist, "plugin/ui.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
});

const [template, script, styles] = await Promise.all([
  readFile(resolve(root, "plugin/src/ui.html"), "utf8"),
  readFile(resolve(dist, "plugin/ui.js"), "utf8"),
  readFile(resolve(root, "plugin/src/ui.css"), "utf8"),
]);

const uiHtml = injectOnce(
  injectOnce(template, "/*__STYLES__*/", styles),
  "/*__SCRIPT__*/",
  script,
);
validateGeneratedUi(uiHtml);

await writeFile(
  resolve(dist, "plugin/ui.html"),
  uiHtml,
  "utf8",
);
await copyFile(
  resolve(root, "plugin/manifest.json"),
  resolve(dist, "plugin/manifest.json"),
);

function injectOnce(template, marker, value) {
  const occurrences = template.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one ${marker} marker, found ${occurrences}.`);
  }

  // A replacement callback keeps `$&`, `$`` and similar JavaScript source
  // sequences literal instead of treating them as String.replace tokens.
  return template.replace(marker, () => value);
}

function validateGeneratedUi(html) {
  const doctypes = html.match(/<!doctype html>/gi)?.length ?? 0;
  const openingScripts = html.match(/<script>/gi)?.length ?? 0;
  const closingScripts = html.match(/<\/script>/gi)?.length ?? 0;
  if (doctypes !== 1 || openingScripts !== 1 || closingScripts !== 1) {
    throw new Error(
      "Generated plugin UI must contain one document and one inline script.",
    );
  }

  const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i)?.[1];
  if (inlineScript === undefined) {
    throw new Error("Generated plugin UI is missing its inline script.");
  }
  new Script(inlineScript, { filename: "dist/plugin/ui.inline.js" });
}
