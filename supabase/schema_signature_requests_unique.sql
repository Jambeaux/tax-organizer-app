-- Embedded Requesting means the signature_requests row now gets created
-- by the webhook (on signature_request_sent) instead of synchronously
-- when staff clicks send, using an upsert keyed on
-- dropbox_sign_request_id. Upsert's ON CONFLICT needs an actual unique
-- constraint to target, which this table never had (only a primary key
-- on `id`). Run this once in the Supabase SQL Editor.
alter table signature_requests
  add constraint signature_requests_dropbox_sign_request_id_key
  unique (dropbox_sign_request_id);
