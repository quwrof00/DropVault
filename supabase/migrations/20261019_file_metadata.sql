-- ============================================================
-- Migration: file_metadata table for zero-knowledge encryption
-- ============================================================
-- Stores the encryption envelope for each uploaded file.
-- Raw DEKs are NEVER stored here — only the KEK-wrapped form.
--
-- Schema design:
--   storage_path   – path in Supabase Storage bucket ("user-files" or "images")
--   file_iv        – base64 AES-GCM IV used to encrypt the file contents
--   encrypted_dek  – base64 AES-GCM ciphertext of the 256-bit DEK
--   dek_iv         – base64 AES-GCM IV used to wrap the DEK with the KEK
--   original_name  – plaintext original filename (for download)
--   original_mime  – original MIME type (so the browser opens the file correctly)
--   file_type      – 'file' | 'image'  (to keep queries for each section separate)
--   room_id        – NULL for personal files, set for room-shared files
-- ============================================================

create table if not exists public.file_metadata (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  room_id        uuid references public.rooms(id) on delete cascade,
  storage_path   text not null,           -- e.g. "abc-uuid/def.enc"
  file_iv        text not null,           -- base64 12-byte IV
  encrypted_dek  text not null,           -- base64 wrapped DEK ciphertext
  dek_iv         text not null,           -- base64 IV used to wrap the DEK
  original_name  text not null,           -- original filename displayed in UI
  original_mime  text not null default 'application/octet-stream',
  original_size  bigint not null default 0,
  file_type      text not null check (file_type in ('file', 'image')),
  created_at     timestamptz not null default now()
);

-- RLS: users can only see their own metadata (or room metadata when in the room)
alter table public.file_metadata enable row level security;

create policy "Users read own metadata"
  on public.file_metadata for select
  using (
    auth.uid() = user_id
    or (room_id is not null and exists (
      select 1 from public.room_users
      where room_users.room_id = file_metadata.room_id
        and room_users.user_id = auth.uid()
    ))
  );

create policy "Users insert own metadata"
  on public.file_metadata for insert
  with check (auth.uid() = user_id);

create policy "Users delete own metadata"
  on public.file_metadata for delete
  using (auth.uid() = user_id);

create policy "Users update own metadata"
  on public.file_metadata for update
  using (auth.uid() = user_id);

-- Index for fast per-user/room lookups
create index if not exists idx_file_metadata_user_id
  on public.file_metadata (user_id);
create index if not exists idx_file_metadata_room_id
  on public.file_metadata (room_id)
  where room_id is not null;
create index if not exists idx_file_metadata_storage_path
  on public.file_metadata (storage_path);

