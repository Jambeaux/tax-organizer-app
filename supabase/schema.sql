-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- Creates a private "documents" bucket and locks it down so each client
-- can only see, upload, and delete their own files.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users can view own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Every uploaded file is stored as {user_id}/{filename}, and these three
-- policies check that the first folder in the path matches the signed-in
-- user's id. That's what keeps client A from ever seeing client B's files.
