#!/usr/bin/env node
// Builds the package for OpenAI's plugin directory (ChatGPT and Codex):
//   node scripts/openai-package.mjs <demo video URL>
// It is plugins/alwen without the Claude Code mod and the other apps' manifests, because
// OpenAI doesn't accept packages with hooks. The listing and test cases come from
// plugins/alwen/plugin.json (extensions.com.openai); the video link is added only to the
// package. Writes dist/alwen-openai-<version>.zip.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = join(root, "plugins/alwen");
const video = process.argv[2];
const fail = (msg) => { console.error(`openai-package: ${msg}`); process.exit(1); };

if (!video || !/^https:\/\/\S+$/.test(video)) fail("give the demo video's https link: node scripts/openai-package.mjs https://…");

const manifest = JSON.parse(readFileSync(join(src, "plugin.json"), "utf8"));
const openai = manifest.extensions?.["com.openai"];
const ui = openai?.interface ?? {};
for (const key of ["displayName", "shortDescription", "longDescription", "developerName", "category", "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "logo"]) {
  if (!ui[key]) fail(`interface.${key} is missing in plugins/alwen/plugin.json`);
}
if (ui.displayName.length > 30 || ui.shortDescription.length > 30) fail("displayName and shortDescription must be 30 characters or less");
const cases = openai.review?.test_cases ?? {};
if (cases.positive?.length !== 5 || cases.negative?.length !== 3) fail("OpenAI wants exactly 5 positive and 3 negative test cases");
for (const icon of [ui.logo, ui.composerIcon].filter(Boolean)) {
  if (!existsSync(join(src, icon))) fail(`${icon} is missing`);
}
openai.review.demo_recording_url = video;

// Only what OpenAI reads: the manifest, the server, the skill, the icons, README and LICENSE.
const SKIP = new Set(["hooks", "types", ".claude-plugin", ".cursor-plugin", ".DS_Store"]);
const work = mkdtempSync(join(tmpdir(), "alwen-openai-"));
const out = join(work, "alwen");
cpSync(src, out, { recursive: true, filter: (path) => !SKIP.has(basename(path)) });
writeFileSync(join(out, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

mkdirSync(join(root, "dist"), { recursive: true });
const zip = join(root, "dist", `alwen-openai-${manifest.version}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", "-q", zip, "."], { cwd: out });
rmSync(work, { recursive: true, force: true });
console.log(`Wrote ${zip}`);
