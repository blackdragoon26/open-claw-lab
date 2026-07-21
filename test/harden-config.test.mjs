import test from "node:test";
import assert from "node:assert/strict";
import { hardenConfig } from "../scripts/harden-openclaw-config.mjs";

const original = {
  agents: { defaults: { workspace: "/old", model: "deepseek/deepseek-chat" } },
  gateway: { bind: "lan", auth: { mode: "token", token: "preserve-me" }, controlUi: { allowInsecureAuth: true } },
  tools: { profile: "coding", web: { search: { provider: "tavily", apiKey: "preserve-search-key" } } },
  channels: { telegram: { botToken: "preserve-bot-token", groups: { "*": { requireMention: false } } } },
  models: { providers: { deepseek: { apiKey: "preserve-provider-key" } } }
};

test("hardens gateway and preserves provider/channel credentials", () => {
  const result = hardenConfig(original, { telegramUser: "123", repoRoot: "/srv/lab" });
  assert.equal(result.gateway.bind, "loopback");
  assert.equal(result.gateway.controlUi.allowInsecureAuth, false);
  assert.deepEqual(result.gateway.auth.rateLimit, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 300_000 });
  assert.equal(result.gateway.auth.token, "preserve-me");
  assert.equal(result.channels.telegram.botToken, "preserve-bot-token");
  assert.equal(result.tools.web.search.apiKey, "preserve-search-key");
  assert.equal(result.models.providers.deepseek.apiKey, "preserve-provider-key");
});

test("creates isolated least-privilege agents and Telegram allowlists", () => {
  const result = hardenConfig(original, { telegramUser: "123", repoRoot: "/srv/lab" });
  assert.deepEqual(result.agents.list.map((agent) => agent.id), ["main", "career-scout", "career-reviewer"]);
  assert.equal(result.agents.list[1].workspace, "/srv/lab/workspaces/scout");
  assert.ok(result.agents.list.every((agent) => agent.tools.deny.includes("exec")));
  assert.deepEqual(result.channels.telegram.allowFrom, ["123"]);
  assert.deepEqual(result.channels.telegram.groupAllowFrom, ["123"]);
  assert.equal(result.agents.defaults.heartbeat.every, "0m");
  assert.equal(result.tools.fs.workspaceOnly, true);
});
