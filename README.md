# Open Claw Lab

An evidence-gated career research pipeline for OpenClaw. It discovers hiring
signals, validates them with deterministic rules, asks a separate reviewer
agent to check survivors, and sends a concise Telegram digest.

The project intentionally does **not** send email or submit applications. It
also refuses guessed email patterns: an address is included only when the exact
address is visible at a cited public URL.

## Pipeline

1. `career-scout` searches public sources and returns structured JSON.
2. `scripts/run-pipeline.mjs` applies geographic, seniority, contact-role,
   freshness, evidence, and deduplication gates.
3. `career-reviewer` independently reviews surviving leads.
4. The trusted host script sends up to five Japan and five global leads.

Quality wins over quota. A digest may contain fewer than ten leads.

## Local verification

```bash
npm test
npm run dry-run
npm run secret-scan
```

See [Operations](docs/OPERATIONS.md) for server installation and recovery.

## Privacy boundary

This public repository contains templates and synthetic fixtures only. Real
profiles, generated leads, OpenClaw state, sessions, credentials, Gmail tokens,
and contact lists belong in ignored `private/` or `var/` directories on the
server.
