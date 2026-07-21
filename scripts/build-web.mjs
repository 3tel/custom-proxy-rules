import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "_site");
await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(resolve(root, "docs/index.html"), resolve(output, "index.html")),
  copyFile(resolve(root, "docs/styles.css"), resolve(output, "styles.css")),
  copyFile(resolve(root, "docs/.nojekyll"), resolve(output, ".nojekyll")),
]);
await build({
  entryPoints: [resolve(root, "docs/app.js")],
  outfile: resolve(output, "app.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["safari15"],
  legalComments: "eof",
});
