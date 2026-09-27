#!/usr/bin/env node
// Packages this single source tree into a per-browser dist/*.zip.
// No bundler: the only per-browser difference is manifest.json, so we
// copy everything except dev files, swap in the right manifest, and zip.
// Usage: node scripts/build.js [chrome|firefox]  (defaults to both)

import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distRoot = path.join(root, "dist");

const EXCLUDE = new Set([
  "dist", "docs", "scripts", ".git", ".github", "node_modules",
  "manifest.firefox.json", "package.json", "package-lock.json",
  ".gitignore", "README.md", "LICENSE"
]);

const TARGETS = {
  chrome: "manifest.json",
  firefox: "manifest.firefox.json"
};

function buildTarget(name) {
  const manifestFile = TARGETS[name];
  if (!manifestFile) throw new Error(`Unknown target: ${name}`);

  const outDir = path.join(distRoot, name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const entry of readdirSync(root)) {
    if (EXCLUDE.has(entry)) continue;
    cpSync(path.join(root, entry), path.join(outDir, entry), { recursive: true });
  }
  copyFileSync(path.join(root, manifestFile), path.join(outDir, "manifest.json"));

  const zipPath = path.join(distRoot, `forcecache-${name}.zip`);
  rmSync(zipPath, { force: true });
  execSync(`cd "${outDir}" && zip -qr "${zipPath}" .`, { stdio: "inherit" });
  console.log(`Built ${path.relative(root, zipPath)}`);
}

const targets = process.argv.slice(2);
mkdirSync(distRoot, { recursive: true });
for (const name of (targets.length ? targets : Object.keys(TARGETS))) {
  buildTarget(name);
}
