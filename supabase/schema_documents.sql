-- Tracks the origin of each file in the "documents" storage bucket so the
-- staff per-client view can separate "documents uploaded by client" from
-- "documents sent from firm" (previously untracked — every upload path
-- wrote straight into `${userId}/${storedName}` in Storage with no
-- metadata about who put it there).
--
-- This does NOT track P&L uploads or signature-request documents — those
-- already have their own tracking (business_tax_organizer_responses.
-- responses->>'profitLossStatementFileName' and the signature_requests
-- table respectively) and get their own sections in the staff UI. Rows
-- here are only for the new "send a plain document" feature and the
-- client's own generic document uploads.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The stored object name inside the client's own storage folder, e.g.
  -- "1699999999999_W2.pdf" — combine with user_id to get the full Storage
  -- path "${user_id}/${file_name}".
  file_name text not null,
  -- The original filename before the timestamp prefix was added, for
  -- display.
  original_name text not null,
  uploaded_by text not null check (uploaded_by in ('client', 'staff')),
  -- Staff member's email when uploaded_by = 'staff'; null for client
  -- uploads.
  uploaded_by_email text,
  -- Optional note from staff shown alongside the document (e.g. "Here's
  -- your engagement letter for this year").
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists documents_user_file_unique
  on documents(user_id, file_name);

create index if not exists documents_user_id_idx on documents(user_id);

alter table documents enable row level security;

-- Clients can see their own document rows (used to know which files in
-- their Documents list came from the firm vs. themselves). All writes go
-- through server routes using the service-role client, so no
-- insert/update/delete policy is needed here.
create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = user_id);
