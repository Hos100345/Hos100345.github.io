-- ============================================================
-- מחולל הדאבל — תוספת עמודות לטבלת profiles (תוקף/סטטוס/תיאור)
-- להרצה ב-SQL Editor. בטוח להרצה חוזרת (add column if not exists).
-- נחוץ אם step1 המקורי לא כלל את העמודות האלה — בלעדיהן התוקף לא נשמר.
-- ============================================================

alter table public.profiles add column if not exists subscription_expires date;
alter table public.profiles add column if not exists subscriber_status   text not null default 'active';
alter table public.profiles add column if not exists label               text;
