-- Run after the other migrations. One ongoing tax organizer profile per
-- client — not tied to a specific tax year, just a living intake record
-- they can update anytime.
--
-- Unlike signature_requests/payment_requests, clients write to this table
-- directly (same pattern as document uploads) rather than through a
-- server-side route, since it's their own self-reported intake info.
--
-- IMPORTANT: per the security note at the bottom of this README, this app
-- isn't ready for real client SSNs until the Milestone 5 security review.
-- The dependents fields intentionally don't include an SSN field for this
-- reason — don't add one before that review happens.

create table if not exists tax_organizer_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'draft',
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tax_organizer_responses enable row level security;

create policy "Users can view own tax organizer"
on tax_organizer_responses for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own tax organizer"
on tax_organizer_responses for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own tax organizer"
on tax_organizer_responses for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
