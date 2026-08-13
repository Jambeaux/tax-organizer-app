-- Run after schema.sql and schema_signatures.sql. Tracks invoices sent to
-- clients and their payment status via Square.
--
-- There's no "create invoice" button in the app yet — for now, create one
-- by inserting a row directly here (Supabase Table Editor, or SQL):
--
--   insert into payment_requests (user_id, description, amount_cents)
--   values ('<client's user id>', 'Tax prep — 2025 return', 45000);
--
-- (amount_cents is the dollar amount x 100, so $450.00 = 45000)

create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending',
  square_order_id text,
  square_payment_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_requests enable row level security;

create policy "Users can view own payment requests"
on payment_requests for select
to authenticated
using (auth.uid() = user_id);

-- Inserts and updates happen server-side via the service role key (which
-- bypasses RLS), triggered by /api/pay/checkout and /api/pay/webhook. The
-- exception is the initial row creation, which for now you do by hand in
-- Supabase directly, same as any other server-side write in this app.
