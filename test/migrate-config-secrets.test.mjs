import test from "node:test";
import assert from "node:assert/strict";
import { migrateSecrets } from "../scripts/migrate-config-secrets.mjs";

test("moves supported plaintext config credentials into file SecretRefs", () => {
  const input = {
    gateway: { auth: { token: "gateway-secret" } },
    models: { providers: { deepseek: { apiKey: "model-secret" } } },
    plugins: { entries: { google: { config: { webSearch: { apiKey: "search-secret" } } } } },
    channels: { telegram: { botToken: "telegram-secret" } }
  };
  const result = migrateSecrets(input, { secretPath: "/secure/secrets.json" });
  assert.equal(result.migrated, 4);
  assert.deepEqual(result.config.gateway.auth.token, { source: "file", provider: "filemain", id: "/gateway/auth/token" });
  assert.equal(result.secrets.gateway.auth.token, "gateway-secret");
  assert.equal(result.secrets.models.providers.deepseek.apiKey, "model-secret");
  assert.equal(result.secrets.plugins.entries.google.config.webSearch.apiKey, "search-secret");
  assert.equal(result.secrets.channels.telegram.botToken, "telegram-secret");
  assert.deepEqual(result.config.secrets.providers.filemain, { source: "file", path: "/secure/secrets.json", mode: "json" });
});

test("does not duplicate fields that are already SecretRefs", () => {
  const ref = { source: "file", provider: "filemain", id: "/gateway/auth/token" };
  const result = migrateSecrets({ gateway: { auth: { token: ref } } });
  assert.equal(result.migrated, 0);
  assert.deepEqual(result.config.gateway.auth.token, ref);
});
