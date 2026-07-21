export function buildDigest(leads, rejected, date) {
  const lines = [`Career Scout - ${date}`, `${leads.length} evidence-verified lead${leads.length === 1 ? "" : "s"}`];
  if (!leads.length) lines.push("", "No leads met every evidence rule today.");

  leads.forEach((lead, index) => {
    const contactRoute = lead.contact.email
      ? `${lead.contact.name} (${lead.contact.role}) - ${lead.contact.email}`
      : `${lead.contact.name} (${lead.contact.role}) - ${lead.contact.publicProfileUrl || lead.contact.applicationUrl}`;
    lines.push(
      "",
      `${index + 1}. [${lead.lane.toUpperCase()}] ${lead.opportunity.title} - ${lead.company.name}`,
      `Location: ${lead.opportunity.location} | ${lead.opportunity.workMode}`,
      `Fit: ${lead.fit.score}/100 - ${lead.fit.reasons.join("; ")}`,
      `Contact: ${contactRoute}`,
      `Role: ${lead.opportunity.sourceUrl}`,
      `Hiring proof: ${lead.hiringSignal.url}`
    );
  });

  const summary = {};
  for (const lead of rejected) {
    for (const reason of lead.verification?.reasons || []) summary[reason] = (summary[reason] || 0) + 1;
  }
  const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
  if (entries.length) {
    lines.push("", `Rejected ${rejected.length}: ${entries.map(([reason, count]) => `${reason}=${count}`).join(", ")}`);
  }
  lines.push("", "Research only. No email or application was sent.");
  return lines.join("\n");
}
