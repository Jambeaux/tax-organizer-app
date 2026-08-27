-- Milestone 6: accounts and invites.
--
-- Two tables:
--
-- 1. `profiles` — one row per signed-up client, holding info Supabase's
--    auth.users table doesn't (name, address, phone, whether they're a
--    business/self-employed client) plus a `status` column. New accounts
--    are approved immediately — CAPTCHA on the sign-in form (Cloudflare
--    Turnstile, see src/app/login/Turnstile.tsx and README) is what
--    keeps bots/spam out, not manual review. `status` is kept around so
--    staff can flag/deactivate a specific account later if ever needed.
--
--    NOTE: earlier versions of this schema defaulted new rows to
--    'pending' and gated dashboard access on staff approval. If you ran
--    that version already, run this once to update existing rows and
--    the default for new ones:
--      update profiles set status = 'approved' where status = 'pending';
--      alter table profiles alter column status set default 'approved';
--
-- 2. `invites` — created by staff (name + email) before a client ever
--    signs up, so the app can pre-fill their name on first login.
--
-- Run this after schema_tax_organizer.sql.

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  phone text,
  address text,
  is_business boolean not null default false,
  status text not null default 'approved' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
on profiles for select
to authenticated
using (auth.uid() = user_id);

-- No insert policy for authenticated/anon on purpose — profile rows are
-- only ever created server-side (via the service role key) the first
-- time someone logs in, so a client can never insert their own
-- already-approved row.
--
-- Updates are allowed, but only to the columns a client should be able
-- to edit themselves (name/phone/address/is_business) — `status` can
-- only ever change through a staff action using the service role key,
-- which bypasses RLS and column grants entirely.
create policy "Users can update own profile"
on profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke update on profiles from authenticated;
grant update (name, phone, address, is_business, updated_at) on profiles to authenticated;

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  email text not null,
  name text,
  note text,
  created_by text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invites enable row level security;

-- No policies at all here on purpose — invites are only ever read or
-- written server-side using the service role key (staff routes, and
-- the profile-creation check at first login). Regular clients never
-- need direct access to this table.

create index if not exists invites_email_idx on invites (lower(email));
