#!/usr/bin/env node
import { chmodSync, copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TARGETS = [
  ["gateway", "auth", "token"],
  ["models", "providers", "deepseek", "apiKey"],
  ["plugins", "entries", "google", "config", "webSearch", "apiKey"],
  ["plugins", "entries", "brave", "config", "webSearch", "apiKey"],
  ["plugins", "entries", "tavily", "config", "webSearch", "apiKey"],
  ["channels", "telegram", "botToken"]
];

function getAt(object, path) {
  return path.reduce((value, key) => value?.[key], object);
}

function setAt(object, path, value) {
  let cursor = object;
  for (const key of path.slice(0, -1)) cursor = cursor[key];
  cursor[path.at(-1)] = value;
}

function setSecret(object, path, value) {
  let cursor = object;
  for (const key of path.slice(0, -1)) {
    cursor[key] ||= {};
    cursor = cursor[key];
  }
  cursor[path.at(-1)] = value;
}

function pointer(path) {
  return `/${path.map((part) => part.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

export function migrateSecrets(config, { secretPath = "/home/openclaw/.openclaw/secrets.json" } = {}) {
  const hardened = structuredClone(config);
  const secrets = {};
  let migrated = 0;
  for (const path of TARGETS) {
    const value = getAt(hardened, path);
    if (typeof value !== "string" || !value) continue;
    const id = pointer(path);
    setSecret(secrets, path, value);
    setAt(hardened, path, { source: "file", provider: "filemain", id });
    migrated += 1;
  }
  hardened.secrets = {
    ...(hardened.secrets || {}),
    providers: {
      ...(hardened.secrets?.providers || {}),
      filemain: { source: "file", path: secretPath, mode: "json" }
    },
    defaults: { ...(hardened.secrets?.defaults || {}), file: "filemain" }
  };
  return { config: hardened, secrets, migrated };
}

function parseArgs(argv) {
  const args = { secretPath: "/home/openclaw/.openclaw/secrets.json" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--secrets") args.secretPath = argv[++i];
    else if (argv[i] === "--write") args.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.config) throw new Error("--config is required");
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.write) throw new Error("--write is required; use a temporary config for dry-run validation");
  const configPath = resolve(args.config);
  const secretPath = resolve(args.secretPath);
  const original = JSON.parse(readFileSync(configPath, "utf8"));
  const result = migrateSecrets(original, { secretPath });
  if (!result.migrated) throw new Error("No plaintext config secrets were found to migrate");

  mkdirSync(dirname(secretPath), { recursive: true, mode: 0o700 });
  writeFileSync(secretPath, `${JSON.stringify(result.secrets, null, 2)}\n`, { mode: 0o600 });
  chmodSync(secretPath, 0o600);

  const backupPath = `${configPath}.pre-secretref`;
  const temporaryPath = resolve(dirname(configPath), `.openclaw.json.${process.pid}.tmp`);
  copyFileSync(configPath, backupPath);
  chmodSync(backupPath, 0o600);
  writeFileSync(temporaryPath, `${JSON.stringify(result.config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, configPath);
  chmodSync(configPath, 0o600);
  console.log(`Migrated ${result.migrated} config secrets to ${secretPath}`);
}
