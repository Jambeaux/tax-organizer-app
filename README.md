# JLB Tax & Bookkeeping — client portal (tax organizer)

MVP milestone 1: client login (magic link, no passwords), a private
dashboard, and secure document upload/download. Each client can only ever
see their own files — enforced at the database level, not just in the app.

## Stack

- Next.js (App Router) — the web app
- Supabase — login and secure document storage
- Dropbox Sign — e-signature (milestone 2)
- Square — payments (milestone 3)
- Vercel — hosting, at portal.jlbtax.com

## One-time setup

1. **Run the database migration.** In your Supabase project, go to
   SQL Editor > New query, paste in everything from `supabase/schema.sql`,
   and run it. This creates the private documents storage bucket and the
   security rules that keep clients' files separated.

2. **Install dependencies.**
   ```
   npm install
   ```

3. **Run it locally.**
   ```
   npm run dev
   ```
   Then open http://localhost:3000 — you'll land on the login page. Enter
   your email, check your inbox for the sign-in link, and you'll be dropped
   into the dashboard.

## Deploying to Vercel

1. Push this folder to a GitHub repo (private repo — this code doesn't
   contain secrets since `.env.local` is gitignored, but no reason to make
   it public).
2. In Vercel, "Add New Project" > import that repo.
3. Under Project Settings > Environment Variables, add the same values
   that are in your local `.env.local` file (Supabase URL and anon key at
   minimum for this milestone).
4. Deploy. Then in Vercel's domain settings, add `portal.jlbtax.com` and
   follow their instructions for the DNS record to add at SiteGround —
   your main site keeps running there untouched.
5. Back in Supabase, under Authentication > URL Configuration, add your
   Vercel/custom domain to the allowed redirect URLs (otherwise the
   magic-link login won't be able to redirect back to the app).

## Milestone 2 — e-signature (Dropbox Sign)

Any document already in a client's Documents list now has a
"Request signature" button. Clicking it sends that file through Dropbox
Sign to the signed-in user's own email for review and signing on Dropbox
Sign's hosted page — the app doesn't email you results yet, it relies on
Dropbox Sign's webhook to know when something's been signed.

Two things to set up before this works end to end:

1. **Run the second migration.** In Supabase SQL Editor, run everything in
   `supabase/schema_signatures.sql` (after `schema.sql`). This adds the
   `signature_requests` table that tracks status.
2. **Add a webhook in Dropbox Sign.** Once deployed, go to your Dropbox
   Sign account > Settings > API, and set the callback/webhook URL to
   `https://portal.jlbtax.com/api/sign/webhook`. Dropbox Sign will ping
   that URL with a test event first — the endpoint already knows to reply
   `Hello API Event Received`, which is what Dropbox Sign expects to
   consider the URL verified.

Confirmed working against a real Dropbox Sign callback_test event. As of
the Milestone 5 security review, the webhook signature check in
`src/app/api/sign/webhook/route.ts` rejects requests with a missing or
invalid signature (401) instead of just logging a warning.

It stays in `DROPBOX_SIGN_MODE=test` (sandbox, no real signatures) until
you deliberately switch it to `live` in your environment variables.

## Milestone 3 — invoicing and payment (Square)

Clients can now see invoices on their dashboard and pay them through a
Square-hosted checkout page. There's no "create invoice" button yet — for
now, you create one by hand:

1. **Run the third migration.** In Supabase SQL Editor, run everything in
   `supabase/schema_payments.sql`. This adds the `payment_requests` table.
2. **Create an invoice manually.** In Supabase's Table Editor (or SQL
   Editor), insert a row into `payment_requests` with the client's
   `user_id`, a `description` (e.g. "Tax prep — 2025 return"), and
   `amount_cents` (dollars x 100, so $450.00 = `45000`). It'll show up on
   that client's dashboard with a "Pay now" button.
3. **Add your Square credentials.** In `.env.local` (and later in Vercel's
   Environment Variables), fill in:
   - `SQUARE_SANDBOX_ACCESS_TOKEN` — from your Square Developer Dashboard,
     Sandbox tab.
   - `SQUARE_SANDBOX_LOCATION_ID` — also in the Sandbox tab (Locations).
   - `SQUARE_SANDBOX_SIGNATURE_KEY` — created in the next step.
   It stays in `SQUARE_MODE=test` (sandbox, no real charges) until you
   deliberately switch it to `live`, same pattern as Dropbox Sign.
4. **Add a webhook in Square.** Once deployed, go to Square Developer
   Dashboard > your app > Webhooks > Add Endpoint, set the URL to
   `https://portal.jlbtax.com/api/pay/webhook`, and subscribe to the
   `payment.updated` event. Square will give you a signature key when you
   save it — that's the value for `SQUARE_SANDBOX_SIGNATURE_KEY` (or
   `SQUARE_PRODUCTION_SIGNATURE_KEY` once you're live).

Confirmed working against a real test event from Square's webhook
dashboard. As of the Milestone 5 security review, the signature check in
`src/app/api/pay/webhook/route.ts` rejects requests with an invalid
signature (401) instead of just logging a warning.

## Milestone 4 — tax organizer questionnaire

Clients now have a "Tax organizer" section on their dashboard: a living
intake form (personal/filing info, dependents, income sources,
deductions, life changes, and general notes) that saves automatically as
they fill it in, plus a "Submit to JLB Tax" button once they're done.

It's a single ongoing profile per client, not tied to a specific tax
year — they can come back and update it anytime their situation changes,
rather than filling out a fresh one every filing season.

Setup: run `supabase/schema_tax_organizer.sql` in Supabase's SQL Editor.
No new environment variables or webhooks needed for this one — unlike
the last two milestones, clients write directly to their own row (same
pattern as document uploads), so there's no external service in the
loop.

**Do not add a Social Security Number field to this form.** The
dependents section deliberately leaves it out — this app isn't cleared
for that kind of data until the Milestone 5 security review (see the
note at the bottom of this file).

There's also no staff-facing view yet — for now, check submitted
responses in Supabase's Table Editor under `tax_organizer_responses`
(the `responses` column holds everything as JSON, `status` tells you
draft vs. submitted).

## Milestone 5 — security review

A first-pass code review of everything built in Milestones 1–4, plus a
few fixes. What changed:

- **Both webhooks now reject bad requests instead of just warning.** The
  Dropbox Sign and Square webhooks originally logged a warning on a
  signature mismatch and kept processing anyway, so they could be
  verified against real events first. Both are now confirmed working, so
  they've been tightened: a missing or invalid signature gets a 401 and
  the request stops there.
- **Fixed a path traversal issue in the e-signature route.**
  `src/app/api/sign/request/route.ts` built a temp file path using the
  client-supplied `documentName` directly. A crafted value with enough
  `../` sequences could have written the uploaded file content somewhere
  outside the intended temp directory. Fixed two ways: `documentName` is
  now validated to reject anything containing `/`, `\`, or `..` before
  it's used anywhere, and the temp filename itself is now a random UUID
  rather than being built from user input at all. The temp file is also
  now cleaned up immediately after each request instead of just relying
  on Vercel wiping `/tmp` between invocations.
- **Confirmed the service-role (admin) Supabase client is never used
  client-side.** It only ever appears in server-only `route.ts` files —
  if it were imported into a `"use client"` component, that key would
  ship to the browser. It isn't, anywhere in the app.
- **Confirmed every table's row-level security policies actually scope
  to the signed-in user** (`documents` storage, `signature_requests`,
  `payment_requests`, `tax_organizer_responses`) — spot-checked that
  each `select`/`insert`/`update` policy requires `auth.uid() = user_id`,
  and that nothing lets one client read or write another client's rows.
- **Confirmed ownership checks on the API routes that take an ID from
  the client.** `/api/pay/checkout` verifies the invoice belongs to the
  signed-in user before creating a checkout link; `/api/sign/request`
  only ever reads from that user's own storage folder, never a
  client-supplied path.
- **Confirmed the payment amount can't be tampered with from the
  browser.** The checkout route reads `amount_cents` from the invoice
  row in the database, not from anything the client sends — a client
  can't pay less than the invoice by editing the request.
- **Fixed one dependency vulnerability** (a high-severity issue in a
  transitive `nanoid` dependency) via `npm audit fix` — 0 vulnerabilities
  as of this review.
- **Confirmed no real secrets are committed anywhere** — `.env.local` is
  gitignored, `.env.local.example` only has blank placeholders, and
  nothing sensitive is hardcoded in source.

**What this is not:** this was a code-level review done by Claude, not a
professional third-party security audit or a compliance review. Since
this app will eventually handle real client SSNs and tax documents for a
licensed tax practice, it's worth having an actual security professional
(and possibly someone familiar with IRS Publication 4557's safeguard
requirements for tax preparers) look it over before real client data
goes through it — especially before enabling live payments or live
e-signatures.

## Roadmap

- [x] Milestone 1 — login, dashboard, secure document upload/download
- [x] Milestone 2 — e-signature via Dropbox Sign
- [x] Milestone 3 — invoicing and payment via Square
- [x] Milestone 4 — tax organizer questionnaire
- [x] Milestone 5 — security review (see above — code-level only, not a professional audit)
- [ ] "Get started" button on the main site links here
- [ ] A real "create invoice" UI for staff, instead of inserting rows by hand
- [ ] A staff-facing view of submitted tax organizer responses

## A note on security

The code-level issues found in the Milestone 5 review have been fixed,
but this still hasn't had a professional security or compliance audit.
Treat it as a working prototype until that happens, especially before
real client SSNs, tax documents, or live payments go through it.
