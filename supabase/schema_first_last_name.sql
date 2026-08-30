-- Splits the client's name into first_name/last_name so staff can see
-- clients labeled as "Last, First" instead of just an email address, and
-- so the same value can be pushed into Supabase Auth's own "Display name"
-- field. `name` (the combined "First Last" string) is kept as-is — it's
-- still used for Dropbox Sign's signer name field, which expects natural
-- order, not "Last, First".
--
-- Run after schema_accounts.sql.

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

-- Same column-level grant pattern as the rest of profiles: clients can
-- self-edit these two new columns, same as name/phone/address already were.
revoke update on profiles from authenticated;
grant update (name, phone, address, is_business, first_name, last_name, updated_at)
  on profiles to authenticated;
