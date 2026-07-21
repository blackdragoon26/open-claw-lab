import { createHash } from "node:crypto";

const DECISION_MAKER = /\b(recruiter|talent|people|human resources|hr|hiring manager|engineering manager|head of engineering|head of people|founder|co-founder|ceo|cto)\b/i;
const FOUNDER = /\b(founder|co-founder|ceo|cto)\b/i;
const SENIOR = /\b(senior|staff|principal|lead|director|head|manager|architect)\b/i;
const GENERIC_EMAIL = /^(careers?|jobs?|hello|info|contact|support|university|recruiting|talent)@/i;
const INDIA_ALLOWED = /\b(worldwide|anywhere|global|india|apac|asia|asia[- ]pacific)\b/i;
const INDIA_BLOCKED = /\b(us only|united states only|canada only|eu only|europe only|uk only|japan residents? only)\b/i;

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function daysBetween(date, reference) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((reference.getTime() - parsed.getTime()) / 86_400_000);
}

export function makeDedupeKey(lead) {
  const raw = [lead.company?.domain, lead.opportunity?.title, lead.opportunity?.location]
    .map((part) => String(part || "").trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

export function validateLead(lead, { now = new Date(), emailEvidenceVerified = false } = {}) {
  const reasons = [];
  const opportunity = lead.opportunity || {};
  const signal = lead.hiringSignal || {};
  const contact = lead.contact || {};
  const company = lead.company || {};

  if (!lead.id || !["japan", "global"].includes(lead.lane)) reasons.push("invalid_identity_or_lane");
  if (!company.name || !company.domain) reasons.push("missing_company");
  if (!opportunity.title || !validUrl(opportunity.sourceUrl)) reasons.push("missing_official_opportunity_source");
  if (!validUrl(signal.url) || !signal.quote || !signal.publishedAt) reasons.push("missing_hiring_signal_evidence");

  if (signal.kind !== "official_job" && daysBetween(signal.publishedAt, now) > 30) {
    reasons.push("stale_hiring_signal");
  }

  if (SENIOR.test(opportunity.title || "") || Number(opportunity.minYearsExperience || 0) > 2) {
    reasons.push("senior_or_experience_mismatch");
  }

  if (opportunity.workMode === "remote") {
    const evidence = `${opportunity.remotePolicy || ""} ${opportunity.eligibilityEvidence || ""}`;
    if (!INDIA_ALLOWED.test(evidence) || INDIA_BLOCKED.test(evidence)) reasons.push("remote_not_confirmed_for_india");
  } else {
    const relocation = opportunity.relocation || {};
    if (!relocation.supported || !validUrl(relocation.evidenceUrl) || !relocation.evidence) {
      reasons.push("onsite_without_funded_relocation_evidence");
    }
  }

  if (!contact.name || !DECISION_MAKER.test(contact.role || "") || !validUrl(contact.roleEvidenceUrl)) {
    reasons.push("contact_not_relevant_or_unverified");
  }
  if (FOUNDER.test(contact.role || "") && (!Number.isInteger(company.employeeCount) || company.employeeCount > 50)) {
    reasons.push("founder_contact_requires_small_company_evidence");
  }

  if (contact.email) {
    if (GENERIC_EMAIL.test(contact.email)) reasons.push("generic_email_rejected");
    if (!validUrl(contact.emailEvidenceUrl)) reasons.push("email_missing_public_evidence_url");
    if (!emailEvidenceVerified) reasons.push("email_not_visible_at_evidence_url");
  } else if (!validUrl(contact.applicationUrl) && !validUrl(contact.publicProfileUrl)) {
    reasons.push("no_verified_contact_route");
  }

  if (!lead.fit || !Number.isInteger(lead.fit.score) || lead.fit.score < 60 || !lead.fit.reasons?.length) {
    reasons.push("weak_or_unexplained_fit");
  }

  return {
    ...lead,
    dedupeKey: makeDedupeKey(lead),
    verification: {
      status: reasons.length ? "rejected" : "verified",
      reasons,
      checkedAt: now.toISOString()
    }
  };
}

export function dedupeLeads(leads) {
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  for (const lead of leads) {
    const key = lead.dedupeKey || makeDedupeKey(lead);
    if (seen.has(key)) {
      rejected.push({
        ...lead,
        dedupeKey: key,
        verification: {
          status: "rejected",
          reasons: [...(lead.verification?.reasons || []), "duplicate_opportunity"],
          checkedAt: lead.verification?.checkedAt || new Date().toISOString()
        }
      });
    } else {
      seen.add(key);
      accepted.push({ ...lead, dedupeKey: key });
    }
  }
  return { accepted, rejected };
}

export function selectDailyLeads(leads, { perLane = 5, total = 10 } = {}) {
  const ranked = [...leads]
    .filter((lead) => lead.verification?.status === "verified")
    .sort((a, b) => b.fit.score - a.fit.score);
  const japan = ranked.filter((lead) => lead.lane === "japan").slice(0, perLane);
  const global = ranked.filter((lead) => lead.lane === "global").slice(0, perLane);
  return [...japan, ...global].sort((a, b) => b.fit.score - a.fit.score).slice(0, total);
}

export function rejectionSummary(leads) {
  const counts = new Map();
  for (const lead of leads) {
    for (const reason of lead.verification?.reasons || []) counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
