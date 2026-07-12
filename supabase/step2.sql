-- ============================================================
-- מחולל הדאבל — Supabase שלב 2: Storage לתמונות אישיות
-- להרצה ב-SQL Editor (אחרי step1.sql). בטוח להרצה חוזרת.
-- כל משתמש ניגש רק לתיקייה שלו: symbols/{user_id}/...
-- ============================================================

-- באקט פרטי לתמונות המשתמשים
insert into storage.buckets (id, name, public)
values ('symbols', 'symbols', false)
on conflict (id) do nothing;

-- RLS על קבצי ה-Storage (storage.objects כבר עם RLS מופעל כברירת מחדל)
drop policy if exists "read own symbols"   on storage.objects;
drop policy if exists "insert own symbols" on storage.objects;
drop policy if exists "update own symbols" on storage.objects;
drop policy if exists "delete own symbols" on storage.objects;

create policy "read own symbols" on storage.objects
  for select using (bucket_id = 'symbols' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "insert own symbols" on storage.objects
  for insert with check (bucket_id = 'symbols' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "update own symbols" on storage.objects
  for update using (bucket_id = 'symbols' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "delete own symbols" on storage.objects
  for delete using (bucket_id = 'symbols' and auth.uid()::text = (storage.foldername(name))[1]);
