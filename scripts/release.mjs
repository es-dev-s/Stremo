#!/usr/bin/env node
// Bumps the version in every place Tauri reads it, then tags and pushes so the
// Release workflow builds installers and publishes latest.json for the updater.
//
//   npm run release            -> patch bump (0.1.0 -> 0.1.1)
//   npm run release minor      -> 0.1.0 -> 0.2.0
//   npm run release 1.4.2      -> exact version
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (run("git", ["status", "--porcelain"])) {
  fail("Working tree is dirty. Commit or stash your changes first.");
}

const pkgPath = resolve(root, "package.json");
const confPath = resolve(root, "src-tauri/tauri.conf.json");
const cargoPath = resolve(root, "src-tauri/Cargo.toml");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const arg = process.argv[2] ?? "patch";
const next =
  arg === "major"
    ? `${major + 1}.0.0`
    : arg === "minor"
      ? `${major}.${minor + 1}.0`
      : arg === "patch"
        ? `${major}.${minor}.${patch + 1}`
        : arg.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  fail(`"${arg}" is not major, minor, patch, or an x.y.z version.`);
}

if (run("git", ["tag", "--list", `v${next}`])) {
  fail(`Tag v${next} already exists.`);
}

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const conf = JSON.parse(readFileSync(confPath, "utf8"));
conf.version = next;
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);

const cargo = readFileSync(cargoPath, "utf8");
writeFileSync(
  cargoPath,
  cargo.replace(/^version = ".*"$/m, `version = "${next}"`),
);

run("git", ["add", "package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"]);
run("git", ["commit", "-m", `release: v${next}`]);
run("git", ["tag", "-a", `v${next}`, "-m", `Stremo v${next}`]);

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
run("git", ["push", "origin", branch]);
run("git", ["push", "origin", `v${next}`]);

console.log(`\n  Released v${next}. GitHub Actions is building the installers.\n`);
