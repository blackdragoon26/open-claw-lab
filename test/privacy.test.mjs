import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAgentError } from "../src/openclaw-client.mjs";
import { sanitizeResearchProfile } from "../scripts/build-research-profile.mjs";

test("provider errors never reproduce the private prompt", () => {
  const diagnostic = "Command failed with --message Email: private@example.com Phone: +91 99999 error 429 quota exceeded";
  const result = sanitizeAgentError(diagnostic);
  assert.equal(result, "model provider quota exceeded (429)");
  assert.doesNotMatch(result, /private@example|99999/);
});

test("research profile removes direct personal contact channels", () => {
  const profile = sanitizeResearchProfile("# Profile\n- Email: private@example.com\n- Phone: +91 99999\n- GitHub: https://github.com/private\n- Location: India\n## Experience\n- Built systems\n");
  assert.doesNotMatch(profile, /private@example|99999|github\.com/);
  assert.match(profile, /Location: India/);
  assert.match(profile, /Built systems/);
});
