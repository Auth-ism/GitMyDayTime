#!/usr/bin/env node
/**
 * Otomatik changelog güncelleyici.
 * deploy.sh tarafından çağrılır: node scripts/update-changelog.mjs <oldVersion> <newVersion> <bump>
 *
 * Commits'ten `packages/web/src/data/changelog.ts` dosyasına yeni bir VersionEntry ekler.
 * Commit prefix'lerine göre type belirlenir: feat | fix | perf | breaking
 * release: ve chore: commit'leri atlanır.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [, , oldVersion, newVersion, bump] = process.argv;
if (!oldVersion || !newVersion || !bump) {
  console.error("Usage: node update-changelog.mjs <oldVersion> <newVersion> <bump>");
  process.exit(1);
}

// ── 1. Commits since last tag ──────────────────────────────────────────────

let rawLog = "";
try {
  rawLog = execSync(`git log "v${oldVersion}..HEAD" --pretty=format:"%s" --no-merges`, {
    cwd: root, encoding: "utf-8",
  });
} catch {
  // If the tag doesn't exist yet, grab the last 40 commits
  rawLog = execSync(`git log -40 --pretty=format:"%s" --no-merges`, {
    cwd: root, encoding: "utf-8",
  });
}

// ── 2. Parse commits ───────────────────────────────────────────────────────

const SKIP = /^(release:|chore:|docs:|style:|test:|ci:|build:)/i;

/** Maps a conventional-commit prefix to our ChangeType */
function typeOf(subject) {
  if (/^feat(\(.*?\))?[!:]/.test(subject))     return "feat";
  if (/^fix(\(.*?\))?[!:]/.test(subject))      return "fix";
  if (/^perf(\(.*?\))?[!:]/.test(subject))     return "perf";
  if (/^breaking(\(.*?\))?[!:]/.test(subject)) return "breaking";
  if (/!:/.test(subject))                       return "breaking"; // breaking change marker
  return null;
}

/** Extract the human description after "type(scope): " */
function descOf(subject) {
  return subject.replace(/^[a-z]+(\(.*?\))?[!]?:\s*/i, "").trim();
}

const changes = rawLog
  .split("\n")
  .map(s => s.trim())
  .filter(s => s && !SKIP.test(s))
  .reduce((acc, subject) => {
    const type = typeOf(subject);
    if (!type) return acc;
    const text = descOf(subject);
    if (!text) return acc;
    // Deduplicate by text
    if (!acc.find(c => c.text === text)) acc.push({ type, text });
    return acc;
  }, []);

if (changes.length === 0) {
  console.log(">> No changelog-worthy commits found, skipping.");
  process.exit(0);
}

// ── 3. Build new entry ─────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

const newEntry = {
  version: newVersion,
  date: today,
  bump,
  changes,
};

// ── 4. Prepend to changelog.ts ─────────────────────────────────────────────

const changelogPath = resolve(root, "packages/web/src/data/changelog.ts");
const existing = readFileSync(changelogPath, "utf-8");

function toTS(entry) {
  const lines = [
    `  {`,
    `    version: "${entry.version}",`,
    `    date: "${entry.date}",`,
    `    bump: "${entry.bump}",`,
  ];
  if (entry.summary) lines.push(`    summary: "${entry.summary}",`);
  lines.push(`    changes: [`);
  for (const c of entry.changes) {
    // Escape double-quotes in text
    const safeText = c.text.replace(/"/g, '\\"');
    lines.push(`      { type: "${c.type}", text: "${safeText}" },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
  return lines.join("\n");
}

const newBlock = toTS(newEntry);

// Insert after "export const CHANGELOG: VersionEntry[] = ["
const marker = "export const CHANGELOG: VersionEntry[] = [";
const idx = existing.indexOf(marker);
if (idx === -1) {
  console.error("Could not find CHANGELOG array in changelog.ts");
  process.exit(1);
}

const insertAt = idx + marker.length;
const updated =
  existing.slice(0, insertAt) +
  "\n" + newBlock + "\n" +
  existing.slice(insertAt);

writeFileSync(changelogPath, updated, "utf-8");
console.log(`>> Changelog updated: v${newVersion} (${changes.length} entries)`);
