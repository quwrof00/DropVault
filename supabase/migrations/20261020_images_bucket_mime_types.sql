-- ============================================================
-- Migration: allow encrypted image uploads in the storage bucket
-- ============================================================
-- Images are encrypted in the browser before upload, so the stored bytes are
-- ciphertext (not a real image) and are uploaded with the content type
-- "application/octet-stream". The "user-images" bucket was restricted to
-- "image/*", which made every encrypted upload fail with:
--   "mime type application/octet-stream is not supported"
--
-- "image/*" is kept so the legacy (pre-encryption) images still validate.
-- The "user-files" bucket has no mime restriction at all.
--
-- Note: the bucket itself is created by hand in the Supabase dashboard. If
-- you create it manually, set "Allowed MIME types" to:
--   image/*, application/octet-stream
-- ============================================================

update storage.buckets
set allowed_mime_types = array['image/*', 'application/octet-stream']
where id = 'user-images';
