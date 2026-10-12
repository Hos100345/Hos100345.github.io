-- ============================================================
-- נגן המשחק (/play/) — כניסה עם קוד מנוי + אימייל (D-70)
-- ============================================================
-- 1. code_only: לקוחות שהושעיה סימן — מספיק להם הקוד, בלי אימייל.
--    ברירת מחדל false = כולם צריכים קוד + אימייל (האימייל = created_for).
alter table public.dobble_access_codes
  add column if not exists code_only boolean not null default false;

-- 2. יומן ניסיונות כניסה לנגן — להגבלת ניחושים (play-load בודק כמה כשלונות היו ב-15 הדקות האחרונות,
--    לפי כתובת ולפי קוד). רק service_role כותב/קורא: RLS פעיל ואין שום policy.
create table if not exists public.play_login_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip text,
  code text,
  ok boolean not null
);
create index if not exists play_login_attempts_at on public.play_login_attempts (at desc);
alter table public.play_login_attempts enable row level security;
