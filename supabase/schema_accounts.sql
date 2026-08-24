-- Milestone 6: accounts, invites, and staff approval.
--
-- Two new tables:
--
-- 1. `profiles` — one row per signed-up client, holding info Supabase's
--    auth.users table doesn't (name, address, phone, whether they're a
--    business/self-employed client) plus an approval `status`. New
--    accounts start as 'pending' and only become 'approved' once staff
--    approves them, or automatically if they signed up using an email
--    a staff member already invited. This is what keeps a random bot
--    or spam signup from getting real access to the portal even though
--    Supabase's own magic-link signup is open to anyone.
--
-- 2. `invites` — created by staff (name + email) before a client ever
--    signs up. When that email later completes magic-link login for the
--    first time, the app auto-approves their new profile and marks the
--    invite used, instead of leaving them in the pending queue.
--
-- Run this after schema_tax_organizer.sql.

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  phone text,
  address text,
  is_business boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved')),
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
