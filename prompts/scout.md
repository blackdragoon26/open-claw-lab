# Career Scout Run

Return only a JSON array matching `schemas/lead.schema.json`. Do not include
Markdown or commentary.

Search for up to 20 current early-career opportunities, split evenly between
Japan and the rest of the world. Use official career pages, public hiring posts,
VC portfolio hiring pages, YC/Wellfound/HN, public GitHub activity, and publicly
indexed LinkedIn/X pages. Never bypass authentication or scrape login-only pages.

Rules:

- Remote work must explicitly accept India, worldwide, global, APAC, or Asia.
- Onsite/hybrid work outside India needs explicit visa or funded relocation proof.
- Reject senior, staff, principal, lead, manager, architect, and roles requiring
  more than two years of experience.
- Contacts must be current recruiters, talent/people staff, hiring managers, or
  engineering managers. A founder/CTO is valid only for companies with at most
  50 employees and a cited size source.
- An email is optional. Include it only if the exact address is visibly published
  at `emailEvidenceUrl`. Never derive an address from a pattern.
- Prefer an official application URL or public profile when no proven email exists.
- Social signals must be no older than 30 days.
- Every factual claim needs a direct URL and a short exact evidence excerpt.
- VCs are discovery sources, not outreach contacts.

The private candidate profile follows after this instruction. Use it only for
fit scoring and never repeat private contact details in the output.
