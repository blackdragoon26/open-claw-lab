import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dedupeLeads, selectDailyLeads, validateLead } from "../src/validation.mjs";

const fixtures = JSON.parse(readFileSync(new URL("../fixtures/raw-leads.json", import.meta.url), "utf8"));
const now = new Date("2026-07-21T08:00:00.000Z");

test("accepts India-compatible remote role with an official route", () => {
  const result = validateLead(fixtures[0], { now });
  assert.equal(result.verification.status, "verified");
});

test("accepts funded onsite relocation for a small founder-led startup", () => {
  const result = validateLead(fixtures[1], { now });
  assert.equal(result.verification.status, "verified");
});

test("rejects guessed email, stale signal, seniority, geography, and irrelevant contact", () => {
  const result = validateLead(fixtures[2], { now });
  assert.equal(result.verification.status, "rejected");
  assert.ok(result.verification.reasons.includes("email_missing_public_evidence_url"));
  assert.ok(result.verification.reasons.includes("email_not_visible_at_evidence_url"));
  assert.ok(result.verification.reasons.includes("stale_hiring_signal"));
  assert.ok(result.verification.reasons.includes("remote_not_confirmed_for_india"));
  assert.ok(result.verification.reasons.includes("senior_or_experience_mismatch"));
  assert.ok(result.verification.reasons.includes("contact_not_relevant_or_unverified"));
});

test("requires exact public evidence before accepting an email", () => {
  const lead = structuredClone(fixtures[0]);
  lead.contact.email = "aiko@sakura.example";
  lead.contact.emailEvidenceUrl = "https://sakura.example/team/aiko";
  assert.equal(validateLead(lead, { now }).verification.status, "rejected");
  assert.equal(validateLead(lead, { now, emailEvidenceVerified: true }).verification.status, "verified");
});

test("rejects founders at companies larger than 50 employees", () => {
  const lead = structuredClone(fixtures[0]);
  lead.contact.role = "Founder and CEO";
  assert.ok(validateLead(lead, { now }).verification.reasons.includes("founder_contact_requires_small_company_evidence"));
});

test("deduplicates equivalent opportunities", () => {
  const first = validateLead(fixtures[0], { now });
  const second = { ...first, id: "copy" };
  const result = dedupeLeads([first, second]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].verification.reasons.includes("duplicate_opportunity"));
});

test("selects at most five per lane and ten overall", () => {
  const japan = Array.from({ length: 7 }, (_, i) => ({ ...validateLead(fixtures[0], { now }), id: `j${i}`, dedupeKey: `j${i}`, fit: { score: 90 - i, reasons: ["fit"] } }));
  const global = Array.from({ length: 7 }, (_, i) => ({ ...validateLead(fixtures[1], { now }), id: `g${i}`, dedupeKey: `g${i}`, fit: { score: 90 - i, reasons: ["fit"] } }));
  const selected = selectDailyLeads([...japan, ...global]);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((lead) => lead.lane === "japan").length, 5);
  assert.equal(selected.filter((lead) => lead.lane === "global").length, 5);
});
