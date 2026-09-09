-- Switching e-signature providers from Dropbox Sign to SignWell. The
-- column previously held a Dropbox Sign signature_request_id; it now
-- holds a SignWell document id, so rename it to something provider-
-- agnostic. The existing unique constraint (added in
-- schema_signature_requests_unique.sql) follows the column rename
-- automatically and still enforces uniqueness — only its name stays
-- stale, which is cosmetic and harmless.
--
-- The status column has always been plain text with no check constraint,
-- so no schema change is needed to also store "draft" and "declined" —
-- SignWell hands us a real document id immediately (even before the
-- staff member finishes placing fields and sends), so rows now start
-- life as "draft" instead of only ever appearing once already "pending".
alter table signature_requests
  rename column dropbox_sign_request_id to external_request_id;

-- Run this once in the Supabase SQL Editor.
