-- ============================================================
-- מחולל הדאבל — Supabase שלב 3: טבלת פעילות (Analytics)
-- להרצה ב-SQL Editor (אחרי step1.sql ו-step2.sql). בטוח להרצה חוזרת.
--
-- כל שימוש במחולל (כניסה / יצירת משחק / בקשת הדפסה) נרשם כשורה כאן,
-- מכל המכשירים. רק המנהל (hoshaya@gmail.com) יכול לקרוא את הנתונים;
-- כל אחד (כולל אנונימי עם anon key) יכול רק להוסיף אירוע — לא לקרוא.
-- ============================================================

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  event       text        not null,   -- unlock | game | print-order
  code        text,                   -- קוד המנוי (אם ידוע)
  label       text,                   -- תיאור/שם (אם ידוע)
  cards       int,                    -- מספר קלפים (לאירוע game/print)
  symbols     int,                    -- סמלים בקלף
  detail      text,                   -- פרטים חופשיים (קוטר/צורה וכו')
  ua          text                    -- דפדפן
);

create index if not exists events_created_idx on public.events (created_at desc);

alter table public.events enable row level security;

-- הוספה: פתוח לכולם (גם אנונימי) — כדי לרשום פעילות מכל מכשיר
drop policy if exists "anyone insert events" on public.events;
create policy "anyone insert events" on public.events
  for insert with check (true);

-- קריאה: רק המנהל
drop policy if exists "admin read events" on public.events;
create policy "admin read events" on public.events
  for select using ( lower(coalesce(auth.jwt() ->> 'email','')) = 'hoshaya@gmail.com' );

-- הרשאות מפורשות (ליתר ביטחון — כדי שרישום הפעילות יעבוד לכל משתמש):
-- כל אחד (אנונימי + מחובר) יכול להוסיף אירוע; קריאה למחוברים (מגובה ב-RLS למנהל בלבד).
grant insert on public.events to anon, authenticated;
grant select on public.events to authenticated;
