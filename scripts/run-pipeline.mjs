#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDigest } from "../src/digest.mjs";
import { dedupeLeads, selectDailyLeads, validateLead } from "../src/validation.mjs";
import { runAgent, sendTelegram } from "../src/openclaw-client.mjs";

function parseArgs(argv) {
  const args = { dryRun: false, skipReview: false, canary: 0, date: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--skip-review") args.skipReview = true;
    else if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--date") args.date = argv[++i];
    else if (argv[i] === "--canary") args.canary = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function loadText(path) { return readFileSync(resolve(path), "utf8"); }

async function emailIsPublished(lead) {
  if (!lead.contact?.email) return false;
  try {
    const response = await fetch(lead.contact.emailEvidenceUrl, { redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return false;
    const body = (await response.text()).toLowerCase();
    return body.includes(lead.contact.email.toLowerCase());
  } catch {
    return false;
  }
}

async function main(args) {
  const bin = process.env.OPENCLAW_BIN || "openclaw";
  const dataDir = resolve(process.env.CAREER_DATA_DIR || "var");
  mkdirSync(dataDir, { recursive: true });
  const now = new Date(`${args.date}T12:00:00.000Z`);

  let raw;
  if (args.input) {
    raw = JSON.parse(loadText(args.input));
  } else {
    const profilePath = process.env.CAREER_PROFILE_PATH || "private/PROFILE.private.md";
    const prompt = `${loadText("prompts/scout.md")}\n\n# Candidate profile\n${loadText(profilePath)}\n\nRun date: ${args.date}`;
    raw = runAgent({ bin, agent: process.env.SCOUT_AGENT || "career-scout", message: prompt });
  }
  if (!Array.isArray(raw)) throw new Error("Scout output must be a JSON array");
  writeFileSync(resolve(dataDir, `${args.date}-raw.json`), `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600 });

  const checked = [];
  for (const lead of raw) {
    const emailEvidenceVerified = await emailIsPublished(lead);
    checked.push(validateLead(lead, { now, emailEvidenceVerified }));
  }
  const initiallyVerified = checked.filter((lead) => lead.verification.status === "verified");
  const initiallyRejected = checked.filter((lead) => lead.verification.status === "rejected");
  const deduped = dedupeLeads(initiallyVerified);
  let survivors = deduped.accepted;
  const rejected = [...initiallyRejected, ...deduped.rejected];

  if (!args.skipReview && survivors.length) {
    const reviewPrompt = `${loadText("prompts/reviewer.md")}\n\nRun date: ${args.date}\n\nCandidates:\n${JSON.stringify(survivors)}`;
    const verdicts = runAgent({ bin, agent: process.env.REVIEWER_AGENT || "career-reviewer", message: reviewPrompt });
    const verdictById = new Map(verdicts.map((item) => [item.id, item]));
    const reviewed = [];
    for (const lead of survivors) {
      const verdict = verdictById.get(lead.id);
      if (verdict?.verdict === "verified") reviewed.push(lead);
      else rejected.push({ ...lead, verification: { status: "rejected", reasons: verdict?.reasons?.length ? verdict.reasons : ["reviewer_did_not_verify"], checkedAt: new Date().toISOString() } });
    }
    survivors = reviewed;
  }

  let selected = selectDailyLeads(survivors);
  if (args.canary > 0) selected = selected.slice(0, args.canary);
  const digest = buildDigest(selected, rejected, args.date);
  writeFileSync(resolve(dataDir, `${args.date}-verified.json`), `${JSON.stringify(selected, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(resolve(dataDir, `${args.date}-rejected.json`), `${JSON.stringify(rejected, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(resolve(dataDir, `${args.date}-digest.txt`), `${digest}\n`, { mode: 0o600 });

  if (args.dryRun) process.stdout.write(`${digest}\n`);
  else {
    const target = process.env.TELEGRAM_TARGET;
    if (!target) throw new Error("TELEGRAM_TARGET is required for delivery");
    sendTelegram({ bin, target, message: digest });
  }
}

const args = parseArgs(process.argv.slice(2));
main(args).catch((error) => {
  const message = `Career Scout failed on ${args.date}: ${error.message}. No email or application was sent.`;
  console.error(message);
  if (!args.dryRun && process.env.TELEGRAM_TARGET) {
    try {
      sendTelegram({ bin: process.env.OPENCLAW_BIN || "openclaw", target: process.env.TELEGRAM_TARGET, message });
    } catch {
      console.error("Career Scout failure alert could not be delivered.");
    }
  }
  process.exitCode = 1;
});
