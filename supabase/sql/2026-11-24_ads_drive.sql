-- S-193: הגבלת קצב לשמירות של שותפים בדרייב (Edge Function ads-drive). ⛔ טרם הורץ — להריץ (execute_sql) רק אחרי אישור הושעיה.
-- עד שהטבלה קיימת ads-drive לא חוסם (fail-open) — רק רושם אזהרה בלוג של הפונקציה.
-- who = 'p-<hash של קוד השותף>' (לא הקוד עצמו). kind: 'save' (מודעה גמורה / התחלת שמירת תבנית) · 'file' (תמונה בתוך תבנית).
-- כתיבה וקריאה רק דרך service_role (הפונקציה). אין policies — RLS פעיל וחוסם anon/authenticated.

create table if not exists public.studio_drive_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  who text not null,
  kind text not null check (kind in ('save', 'file')),
  action text not null,
  ok boolean not null default true,
  bytes integer
);
create index if not exists studio_drive_log_who_kind_created_idx on public.studio_drive_log (who, kind, created_at desc);
alter table public.studio_drive_log enable row level security;
revoke all on public.studio_drive_log from anon, authenticated;

-- ניקוי (רשות, אפשר להריץ מדי פעם): select count(*) from studio_drive_log; delete from studio_drive_log where created_at < now() - interval '90 days';
