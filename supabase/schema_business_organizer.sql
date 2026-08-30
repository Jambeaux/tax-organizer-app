-- Milestone 6: a separate business/self-employment tax organizer, for
-- clients who have their own business or self-employment income in
-- addition to (or instead of) regular W-2 wages. Kept as its own table
-- rather than folded into tax_organizer_responses, since the questions
-- are genuinely different (business income/expenses vs. personal
-- filing info) and a client may have one, the other, or both.
--
-- Same pattern as tax_organizer_responses: one ongoing profile per
-- client, client writes to their own row directly, RLS scoped to
-- auth.uid() = user_id.
--
-- Run after schema_tax_organizer.sql.

create table if not exists business_tax_organizer_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'draft',
  responses jsonb not null default '{}'::jsonb,
  needs_attention boolean not null default false,
  attention_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table business_tax_organizer_responses enable row level security;

create policy "Users can view own business tax organizer"
on business_tax_organizer_responses for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own business tax organizer"
on business_tax_organizer_responses for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own business tax organizer"
on business_tax_organizer_responses for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- RLS policies alone aren't sufficient — Postgres also checks plain table
-- privileges before RLS ever runs. tax_organizer_responses worked without
-- this line because it inherited default privileges from an earlier state
-- of this project; being explicit here avoids relying on that.
grant select, insert, update on business_tax_organizer_responses to authenticated;
