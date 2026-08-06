-- Run after schema.sql. Tracks e-signature requests sent through Dropbox Sign.
-- This table is written to by the server only (using the service role key),
-- so clients can read their own rows but never write directly.

create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_name text not null,
  dropbox_sign_request_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table signature_requests enable row level security;

create policy "Users can view own signature requests"
on signature_requests for select
to authenticated
using (auth.uid() = user_id);

-- Inserts and updates happen server-side via the service role key (which
-- bypasses RLS), triggered by /api/sign/request and /api/sign/webhook.
