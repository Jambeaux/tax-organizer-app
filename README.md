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

## Staff invoice UI

There's now a `/staff` page for creating and viewing invoices, instead
of inserting rows into `payment_requests` by hand.

**Setup:** add a `STAFF_EMAILS` environment variable (comma-separated,
e.g. `jason@jlbtax.com,otherstaff@jlbtax.com`) in `.env.local` and in
Vercel's Environments settings. Anyone signing in with one of those
emails gets a "Go to staff dashboard →" link on their own dashboard and
can visit `/staff` directly; everyone else who tries gets redirected
back to their client dashboard.

No new database table for this — it's a plain email allowlist, checked
server-side in `src/lib/staff.ts`. To add or remove staff, edit the env
var and redeploy.

The staff page lets you pick a client from a dropdown (populated from
every signed-up account that isn't in the staff list), enter a
description and dollar amount, and create the invoice — which then shows
up on that client's dashboard exactly like one created by hand. Below
the form is a read-only list of every invoice ever sent, across all
clients, with its paid/pending status.

## Staff tax organizer view

The `/staff` page now has a second section below invoices: every
client's tax organizer, sorted by most recently updated, showing their
email and draft/submitted status. Click a row to expand it into a
readable summary — filing status, dependents, which income/deduction/
life-change boxes are checked (not the ones left unchecked), and any
notes — instead of staff having to read raw JSON in Supabase's Table
Editor.

No setup needed — it uses the same `STAFF_EMAILS` allowlist as the
invoice UI.

## Milestone 6 — accounts, invites, business organizer, and correspondence

Before this milestone, anyone who found the login page could sign up
with any email and get straight into a dashboard — there was no way to
tell a real client from a bot or a stranger poking around. This
milestone adds an approval step, a way to invite specific clients, a
second organizer for business/self-employment income, and a few
smaller trust and personalization touches.

**What's new:**

- **New accounts start out "pending."** ~~Someone can still sign in with
  just their email (same magic-link flow as before), but their
  dashboard shows a "we're reviewing your account" message instead of
  their documents until a staff member approves them.~~ **Superseded in
  Milestone 7 — see below.** New accounts are approved immediately now;
  CAPTCHA on the sign-in form is what keeps bots out instead.
- **Staff can invite a client ahead of time.** From `/staff`, enter a
  name and email to create an invite — when that person later signs in
  with that same email, their name is pre-filled on their profile
  automatically. The invite list also gives you a shareable link to
  copy and send however you'd like (text, email, in person).
- **Staff can still approve or reject accounts** from the "Pending
  accounts" section at the top of `/staff` (only shows up if any exist).
  Reject deletes the account outright — meant for obvious spam/bot
  signups, or to remove any account after the fact.
- **A name and mailing address are now part of the (personal) tax
  organizer**, and sync automatically to the client's profile — so
  staff see a real name instead of just an email address throughout
  `/staff`.
- **A separate business tax organizer** for clients with self-employment,
  1099, or business income — business name/type, income, expense
  categories, employees/contractors, and whether they already have a
  profit & loss statement. A client can fill out the personal
  organizer, the business one, or both (e.g. someone with a W-2 job
  and a side business) — there's a checkbox on the dashboard
  ("I also have self-employment, 1099, or business income") that
  reveals it, and that choice is remembered on their profile.
- **Clients can flag their own situation as needing extra attention**,
  on both organizers — a checkbox plus a short note. Staff see a red
  "Needs attention" badge on that client's row in `/staff`, with the
  note shown when expanded, instead of relying on staff to notice
  something buried in free-text.
- **Dropbox Sign now addresses the client by name** (from their profile)
  instead of just their email address, when a signature request goes
  out. Square's quick-pay checkout doesn't have an equivalent spot for
  this — it's a hosted page where the buyer enters their own info, so
  there's nothing to personalize there with the current integration.
- **A short anti-phishing note on the login page**, reminding clients
  that JLB Tax will never call, text, or email asking for a password,
  SSN, or card number, and that sign-in only ever happens through that
  page.

**Setup:**

1. Run the three new migrations, in order, in Supabase's SQL Editor:
   `supabase/schema_accounts.sql`, then
   `supabase/schema_needs_attention.sql`, then
   `supabase/schema_business_organizer.sql`.
2. No new environment variables or webhooks — everything here uses the
   same Supabase project and the existing `STAFF_EMAILS` allowlist.
3. **If you already have client accounts from before this milestone**,
   their first login after this deploy will create a profile row for
   them automatically, defaulting to `pending` — you'll need to approve
   each of them once from the new "Pending accounts" list (or add an
   invite for their email beforehand, so they're approved the moment
   they log in). Existing staff accounts aren't affected — the pending
   gate only applies to non-staff emails.

**A note on this build:** this milestone's code passes a full
TypeScript check (`npx tsc --noEmit`) with no errors from anything
touched here (two pre-existing, unrelated errors about the `square`
package's type declarations were already there before this milestone
and aren't something this work introduced). A full `next build` could
not be completed inside this working session — Turbopack's build cache
doesn't get along with this session's connected-folder protections
against deleting files, and a from-scratch build in a scratch directory
didn't finish before the session's time budget ran out. Run
`npm run build` yourself before deploying, or just let Vercel's own
build be the real check — Vercel builds in a normal environment without
either of those constraints.

## Milestone 7 — CAPTCHA instead of manual account approval

Milestone 6's "pending until staff approves" gate added a step between
signing up and getting real access — meant to keep bots and spam out,
but it also meant every real client had to wait on a staff member. This
milestone replaces that gate with CAPTCHA on the sign-in form itself:
bots get stopped before they can even request a sign-in link, and real
people get straight into their dashboard the moment they click it —
no waiting on anyone.

**What's new:**

- **Cloudflare Turnstile on the sign-in form** (`src/app/login/Turnstile.tsx`).
  Renders automatically if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; the
  "Send sign-in link" button stays disabled until it's solved, and the
  token is passed straight through to Supabase's own CAPTCHA
  verification via `signInWithOtp`.
- **New accounts are approved immediately** — `getOrCreateProfile` no
  longer sets new profiles to `pending`, and the dashboard no longer
  checks `status` before showing a client their documents.
- **The staff "Pending accounts" and invite-approval flow still exists**
  in the code (approve/reject buttons, `status` column) in case you
  ever want to flag or remove a specific account by hand, but it's no
  longer something a normal signup passes through.

**Setup (required for CAPTCHA to actually run):**

1. Create a free Cloudflare account if you don't have one, then go to
   the Turnstile section of the dashboard and add a new site for
   `portal.jlbtax.com` (widget mode: Managed is fine). This gives you a
   **Site Key** and a **Secret Key**.
2. In Vercel, add an environment variable
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set to the Site Key, then redeploy.
   (Also add it to your local `.env.local` if you want CAPTCHA to show
   up when running the app locally.)
3. In Supabase, go to Authentication → Attack Protection (naming may
   vary slightly by Supabase version), enable CAPTCHA protection,
   choose Turnstile, and paste in the **Secret Key**. This is what
   actually verifies the token server-side — the app itself never sees
   or needs the secret key.
4. Until step 1–3 are done, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset,
   so the widget simply doesn't render and sign-in works exactly as
   before (no CAPTCHA, no error) — safe to deploy this code ahead of
   setting up the Cloudflare/Supabase side.

**If you have existing accounts stuck in `pending` from before this
milestone** (they can still sign in and use the dashboard now — the
gate is gone — but they'll still show as "Pending" in the `/staff`
list), you can clean that up cosmetically by running this once in
Supabase's SQL Editor:

```sql
update profiles set status = 'approved' where status = 'pending';
```

## Roadmap

- [x] Milestone 1 — login, dashboard, secure document upload/download
- [x] Milestone 2 — e-signature via Dropbox Sign
- [x] Milestone 3 — invoicing and payment via Square
- [x] Milestone 4 — tax organizer questionnaire
- [x] Milestone 5 — security review (see above — code-level only, not a professional audit)
- [x] A real "create invoice" UI for staff, instead of inserting rows by hand
- [x] A staff-facing view of submitted tax organizer responses
- [x] Milestone 6 — accounts/approval, invites, business organizer, needs-attention flag, personalized Dropbox Sign
- [x] Milestone 7 — CAPTCHA on sign-in, replacing manual account approval
- [ ] "Get started" button on the main site links here

## A note on security

The code-level issues found in the Milestone 5 review have been fixed,
but this still hasn't had a professional security or compliance audit.
Treat it as a working prototype until that happens, especially before
real client SSNs, tax documents, or live payments go through it.
