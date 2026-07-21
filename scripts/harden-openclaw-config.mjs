#!/usr/bin/env node
import { chmodSync, copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function hardenConfig(input, { telegramUser, repoRoot = "/home/openclaw/open-claw-lab" }) {
  if (!telegramUser) throw new Error("telegramUser is required");
  const config = structuredClone(input);
  const existingDefaults = config.agents?.defaults || {};
  config.agents = {
    ...(config.agents || {}),
    defaults: {
      ...existingDefaults,
      workspace: "/home/openclaw/.openclaw/workspace-main",
      model: "google/gemini-2.5-flash",
      memorySearch: { ...(existingDefaults.memorySearch || {}), enabled: false },
      heartbeat: { ...(existingDefaults.heartbeat || {}), every: "0m" }
    },
    list: [
      {
        id: "main",
        default: true,
        workspace: "/home/openclaw/.openclaw/workspace-main",
        model: "google/gemini-2.5-flash",
        tools: {
          profile: "minimal",
          alsoAllow: ["group:messaging", "group:web", "group:memory"],
          deny: ["exec", "process", "write", "edit", "apply_patch", "browser", "nodes"]
        }
      },
      {
        id: "career-scout",
        workspace: `${repoRoot}/workspaces/scout`,
        model: "google/gemini-2.5-flash",
        tools: {
          profile: "minimal",
          alsoAllow: ["group:web"],
          deny: ["exec", "process", "write", "edit", "apply_patch", "group:messaging", "browser", "nodes", "cron"]
        }
      },
      {
        id: "career-reviewer",
        workspace: `${repoRoot}/workspaces/reviewer`,
        model: "google/gemini-3.1-pro-preview",
        tools: {
          profile: "minimal",
          alsoAllow: ["group:web"],
          deny: ["exec", "process", "write", "edit", "apply_patch", "group:messaging", "browser", "nodes", "cron"]
        }
      }
    ]
  };

  config.gateway = {
    ...(config.gateway || {}),
    mode: "local",
    bind: "loopback",
    port: 18789,
    auth: {
      ...(config.gateway?.auth || {}),
      mode: "token",
      rateLimit: { maxAttempts: 10, windowMs: 60_000, lockoutMs: 300_000 }
    },
    controlUi: { ...(config.gateway?.controlUi || {}), allowInsecureAuth: false }
  };
  delete config.gateway.controlUi.allowedOrigins;

  config.tools = {
    ...(config.tools || {}),
    profile: "minimal",
    fs: { ...(config.tools?.fs || {}), workspaceOnly: true },
    elevated: { ...(config.tools?.elevated || {}), enabled: false }
  };

  config.commands = {
    ...(config.commands || {}),
    ownerAllowFrom: [`telegram:${telegramUser}`]
  };

  const telegram = config.channels?.telegram || {};
  config.channels = {
    ...(config.channels || {}),
    telegram: {
      ...telegram,
      enabled: true,
      dmPolicy: "allowlist",
      allowFrom: [String(telegramUser)],
      groupPolicy: "disabled"
    }
  };
  delete config.channels.telegram.groupAllowFrom;
  delete config.channels.telegram.groups;
  return config;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--telegram-user") args.telegramUser = argv[++i];
    else if (argv[i] === "--repo-root") args.repoRoot = argv[++i];
    else if (argv[i] === "--write") args.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config) throw new Error("--config is required");
  const configPath = resolve(args.config);
  const original = JSON.parse(readFileSync(configPath, "utf8"));
  const hardened = hardenConfig(original, args);
  const serialized = `${JSON.stringify(hardened, null, 2)}\n`;
  if (!args.write) process.stdout.write(serialized);
  else {
    const backupPath = `${configPath}.pre-career-scout`;
    const temporaryPath = resolve(dirname(configPath), `.openclaw.json.${process.pid}.tmp`);
    copyFileSync(configPath, backupPath);
    chmodSync(backupPath, 0o600);
    writeFileSync(temporaryPath, serialized, { mode: 0o600 });
    renameSync(temporaryPath, configPath);
    chmodSync(configPath, 0o600);
    console.log(`Hardened ${configPath}; backup: ${backupPath}`);
  }
}
