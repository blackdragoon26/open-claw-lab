import { execFileSync } from "node:child_process";

function collectStrings(value, found = []) {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, found));
  return found;
}

function parseEmbeddedJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      const start = candidate.indexOf("[");
      const end = candidate.lastIndexOf("]");
      if (start >= 0 && end > start) {
        try { return JSON.parse(candidate.slice(start, end + 1)); } catch { /* continue */ }
      }
    }
  }
  throw new Error("Agent response did not contain valid JSON");
}

export function runAgent({ bin, agent, message, timeoutSeconds = 600 }) {
  const stdout = execFileSync(bin, ["agent", "--agent", agent, "--message", message, "--json", "--timeout", String(timeoutSeconds)], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  let envelope;
  try { envelope = JSON.parse(stdout); } catch { envelope = stdout; }
  const strings = collectStrings(envelope).sort((a, b) => b.length - a.length);
  for (const value of strings) {
    try { return parseEmbeddedJson(value); } catch { /* try next */ }
  }
  return parseEmbeddedJson(stdout);
}

export function sendTelegram({ bin, target, message }) {
  execFileSync(bin, ["message", "send", "--channel", "telegram", "--target", target, "--message", message], {
    stdio: "inherit"
  });
}
