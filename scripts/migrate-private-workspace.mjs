#!/usr/bin/env node
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source") args.source = argv[++i];
    else if (argv[i] === "--destination") args.destination = argv[++i];
    else if (argv[i] === "--memory") args.memory = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.source || !args.destination || !args.memory) throw new Error("--source, --destination, and --memory are required");
  return args;
}

export function migrateWorkspace({ source, destination, memory }) {
  const src = resolve(source);
  const dest = resolve(destination);
  if (!existsSync(src)) throw new Error(`Source workspace does not exist: ${src}`);
  if (!existsSync(memory)) throw new Error(`Memory file does not exist: ${memory}`);
  if (!existsSync(dest)) cpSync(src, dest, { recursive: true, preserveTimestamps: true });

  copyFileSync(memory, join(dest, "MEMORY.md"));
  chmodSync(join(dest, "MEMORY.md"), 0o600);

  const bootstrap = join(dest, "BOOTSTRAP.md");
  if (existsSync(bootstrap)) {
    const archive = join(dest, "archive");
    mkdirSync(archive, { recursive: true, mode: 0o700 });
    renameSync(bootstrap, join(archive, "BOOTSTRAP.completed.md"));
  }

  const agentsPath = join(dest, "AGENTS.md");
  const marker = "<!-- career-scout-private-policy -->";
  const policy = `\n\n${marker}\n## Private Career Policy\n\n- Read MEMORY.md at the start of private main sessions.\n- Never guess candidate details, people, roles, email addresses, relocation, or geographic eligibility.\n- Never send email, submit applications, or post externally. The trusted host orchestrator alone delivers research digests.\n- Career claims require direct public source URLs. If evidence is unclear, say so and stop.\n`;
  const agents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "# Agent Instructions\n";
  if (!agents.includes(marker)) writeFileSync(agentsPath, `${agents.trimEnd()}${policy}`, { mode: 0o600 });
  chmodSync(agentsPath, 0o600);
  return { destination: dest, memory: join(dest, "MEMORY.md"), bootstrapArchived: !existsSync(bootstrap) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  console.log(JSON.stringify(migrateWorkspace(parseArgs(process.argv.slice(2)))));
}
