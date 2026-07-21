#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function sanitizeResearchProfile(content) {
  const privateLine = /^- (?:Email|Phone|Portfolio|LinkedIn|GitHub|Twitter\/X):/i;
  return content
    .split(/\r?\n/)
    .filter((line) => !privateLine.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = parseArgs(process.argv.slice(2));
  writeFileSync(args.output, sanitizeResearchProfile(readFileSync(args.input, "utf8")), { mode: 0o600 });
  chmodSync(args.output, 0o600);
  console.log(`Wrote sanitized research profile to ${args.output}`);
}
