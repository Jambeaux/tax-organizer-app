# JLB Tax & Bookkeeping — client portal (tax organizer)

MVP milestone 1: client login (magic link, no passwords), a private
dashboard, and secure document upload/download. Each client can only ever
see their own files — enforced at the database level, not just in the app.

## Stack

- Next.js (App Router) — the web app
- Supabase — login and secure document storage
- Dropbox Sign — e-signature (not wired up yet, milestone 2)
- Square — payments (not wired up yet, milestone 3)
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

This hasn't been tested against a real Dropbox Sign event yet (I don't
have a live account to fire a test callback from this end) — the webhook
signature verification in `src/app/api/sign/webhook/route.ts` currently
logs a warning rather than rejecting on mismatch, specifically so you can
watch your server logs the first time a real event comes through and
confirm the format matches, before tightening it to reject bad requests.

It stays in `DROPBOX_SIGN_MODE=test` (sandbox, no real signatures) until
you deliberately switch it to `live` in your environment variables.

## Roadmap

- [x] Milestone 1 — login, dashboard, secure document upload/download
- [x] Milestone 2 — e-signature via Dropbox Sign (needs live testing — see above)
- [ ] Milestone 3 — invoicing and payment via Square
- [ ] Milestone 4 — the actual tax organizer questionnaire
- [ ] Milestone 5 — security review before real client data goes through it
- [ ] "Get started" button on the main site links here

## A note on security

This app is not ready for real client SSNs or tax documents until
milestone 5 is done. Until then, treat it as a working prototype only.
