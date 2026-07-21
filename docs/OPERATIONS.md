# Operations

## Trust boundaries

- Git contains templates and code only.
- `private/PROFILE.private.md` and `private/pipeline.env` are mode `0600`.
- `var/` contains generated leads and is never committed.
- Model agents have public web tools only. The trusted host orchestrator owns
  validation, local writes, and Telegram delivery.
- Gmail sending is deliberately absent.

## Installation outline

1. Back up `~/.openclaw`, the active workspace, integrations, agent state, and
   crontab to a root-readable timestamped archive.
2. Clone this repository to `/home/openclaw/open-claw-lab`.
3. Copy `PROFILE.example.md` to `private/PROFILE.private.md` and populate it.
4. Create `private/pipeline.env` from `.env.example`; keep it mode `0600`.
5. Merge `config/openclaw.example.json` with the live config without copying
   placeholder values over real secret references.
6. Install and enable the OpenClaw gateway service.
7. Install the service and timer files under `/etc/systemd/system`, reload
   systemd, and run a dry canary before enabling the timer.

## Dashboard access

The gateway listens on loopback. From a trusted workstation:

```bash
ssh -L 18789:127.0.0.1:18789 \
  -i ~/.ssh/keys/openclaw-oracle.key ubuntu@SERVER_IP
```

Then open `http://127.0.0.1:18789/`.

## Validation

```bash
npm test
npm run secret-scan
node scripts/run-pipeline.mjs --dry-run --input fixtures/raw-leads.json --skip-review
openclaw config validate
openclaw security audit --deep
systemctl status openclaw-gateway.service
systemctl status openclaw-career-scout.timer
journalctl -u openclaw-career-scout.service -n 100 --no-pager
```

## Failure behavior

The service exits nonzero on malformed model output, provider errors, missing
configuration, or failed delivery. It does not weaken evidence rules to fill a
quota. Inspect the journal, fix the provider/configuration issue, and rerun the
oneshot service manually.
