-- The upload page always calls .upload(path, file, { upsert: true }), which
-- becomes an UPDATE (not just INSERT) whenever the path already exists —
-- e.g. re-picking a same-named photo after resuming a draft with the same
-- reportId. Only INSERT/SELECT policies existed on this bucket, so any such
-- re-upload failed with "new row violates row-level security policy".
create policy "online-report-photos public update"
  on storage.objects for update
  to public
  using (bucket_id = 'online-report-photos')
  with check (bucket_id = 'online-report-photos');
