import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const packageJsonPath = resolve(root, "package.json");
const versionFilePath = resolve(root, "src", "version.ts");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const nextContent = `export const VERSION = "${packageJson.version}";\n`;

let currentContent = "";
try {
  currentContent = readFileSync(versionFilePath, "utf8");
} catch {
  // Create the file if it does not exist.
}

if (currentContent !== nextContent) {
  writeFileSync(versionFilePath, nextContent, "utf8");
  console.log(`Updated src/version.ts to ${packageJson.version}`);
} else {
  console.log("src/version.ts already up to date");
}
