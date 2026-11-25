-- W-75: ספריית העיצובים של עיצובישי (library/ + Edge Function design-library).
-- ⛔ טרם הורץ — להריץ (execute_sql) רק אחרי אישור הושעיה. הקובץ אידמפוטנטי: אפשר להריץ שוב בלי נזק.
-- כל הכתיבה עוברת דרך הפונקציה (service_role). לטבלאות החדשות אין policies — RLS פעיל וחוסם anon/authenticated.
--
-- 🔑 הקוד המשותף לא נשמר בריפו ולא בטבלה — רק sha256 של 'dl:' + UPPER(code) (בלי רווחים).
--    הדרך המומלצת: בדף library/ במצב מנהל → לשונית "🔑 קוד שותף" (פעולה admin_set_code). כך הקוד לא עובר בשום SQL.
--    לחלופין, ידנית ב-SQL Editor (לא לשמור את השורה בשום קובץ):
--      update public.design_library_codes set active = false where active;
--      insert into public.design_library_codes (code_hash, label)
--        values (encode(sha256(convert_to('dl:' || upper(replace('<הקוד>', ' ', '')), 'UTF8')), 'hex'), 'שותפים')
--        on conflict (code_hash) do update set active = true, label = excluded.label;

-- ── הטבלה הראשית (כבר קיימת — נוצרה בסשן אחר; כאן רק למקרה שלא) ──
create table if not exists public.design_library (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null default '',
  category text not null default 'אחר' check (category in ('כוסות','מזוזות','תמונות','מחזיקי מפתחות','אחר')),
  asset_path text not null,
  contributor text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  duplicate_of uuid references public.design_library (id) on delete set null,
  correction text,
  reviewed_at timestamptz
);
alter table public.design_library enable row level security;

alter table public.design_library add column if not exists contributor_hash text;
alter table public.design_library add column if not exists file_sha256 text;
alter table public.design_library add column if not exists width integer;
alter table public.design_library add column if not exists height integer;
alter table public.design_library add column if not exists asset_cut_path text;
alter table public.design_library add column if not exists rating_avg numeric(3,2) not null default 0;
alter table public.design_library add column if not exists rating_count integer not null default 0;

create index if not exists design_library_status_created_idx on public.design_library (status, created_at desc);
create index if not exists design_library_status_rating_idx on public.design_library (status, rating_avg desc, rating_count desc);
-- כפילויות מסומנות (duplicate_of), לא נחסמות — לכן אינדקס רגיל ולא unique
create index if not exists design_library_sha_idx on public.design_library (file_sha256);

-- ה-policy הקיים (SELECT ל-anon/authenticated כש-status='approved') נשאר. מצמצמים את העמודות הגלויות:
-- contributor_hash / file_sha256 / correction / נתיבי הקבצים לא נחשפים דרך PostgREST. הדף עצמו קורא רק דרך הפונקציה.
revoke select on public.design_library from anon, authenticated;
revoke insert, update, delete on public.design_library from anon, authenticated;
grant select (id, created_at, title, category, contributor, status, width, height, rating_avg, rating_count) on public.design_library to anon, authenticated;

-- ── הקוד המשותף (hash בלבד) ──
create table if not exists public.design_library_codes (
  code_hash text primary key,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.design_library_codes enable row level security;
revoke all on public.design_library_codes from anon, authenticated;

-- ── דירוגים: הצבעה אחת לכל מצביע לכל עיצוב (voter_hash = sha256 של IP + מזהה מכשיר) ──
create table if not exists public.design_ratings (
  design_id uuid not null references public.design_library (id) on delete cascade,
  voter_hash text not null,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (design_id, voter_hash)
);
alter table public.design_ratings enable row level security;
revoke all on public.design_ratings from anon, authenticated;

-- חישוב מחדש של הממוצע והמספר על השורה בכל שינוי דירוג
create or replace function public.design_ratings_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare d uuid := coalesce(new.design_id, old.design_id);
begin
  update public.design_library l
     set rating_avg = coalesce((select round(avg(r.stars)::numeric, 2) from public.design_ratings r where r.design_id = d), 0),
         rating_count = (select count(*) from public.design_ratings r where r.design_id = d)
   where l.id = d;
  return null;
end $$;
revoke all on function public.design_ratings_recalc() from public, anon, authenticated;

drop trigger if exists design_ratings_recalc_trg on public.design_ratings;
create trigger design_ratings_recalc_trg
  after insert or update or delete on public.design_ratings
  for each row execute function public.design_ratings_recalc();

-- ── יומן להגבלת קצב: who_hash = hash של הקוד / המצביע / ה-IP (לא ערכים גלויים) ──
-- action: 'upload' · 'rate' · 'bad_code'
create table if not exists public.design_library_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  who_hash text not null,
  action text not null,
  ok boolean not null default true
);
create index if not exists design_library_log_who_idx on public.design_library_log (who_hash, action, created_at desc);
create index if not exists design_library_log_action_idx on public.design_library_log (action, created_at desc);
alter table public.design_library_log enable row level security;
revoke all on public.design_library_log from anon, authenticated;

-- ── ה-bucket (כבר קיים, פרטי). רק למקרה שלא: ──
insert into storage.buckets (id, name, public) values ('design-library', 'design-library', false)
  on conflict (id) do nothing;

-- ניקוי (רשות): delete from public.design_library_log where created_at < now() - interval '30 days';
