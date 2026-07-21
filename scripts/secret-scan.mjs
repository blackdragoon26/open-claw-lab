#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const ignored = new Set([".git", "node_modules", "var", "private"]);
const patterns = [
  ["Google API key", /AIzaSy[A-Za-z0-9_-]{30,}/g],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["Telegram bot token", /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (ignored.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const findings = [];
for (const path of files(root)) {
  let content;
  try { content = readFileSync(path, "utf8"); } catch { continue; }
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${relative(root, path)}: ${label}`);
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No high-confidence secrets found.");
}
