-- W-49 + D-90: מתנה במחולל (מאצ׳טו) ממרכז הניהול — לפי כמה קלפים, כמה הורדות ולכמה זמן.
-- ⛔ בלי drop ובלי מחיקת נתונים: רק add column if not exists / create table if not exists / create or replace.
-- אפשר להריץ שוב ושוב (idempotent). הרצה: SQL Editor בדשבורד Supabase.
--
-- למה האכיפה בשרת: ספירה בדפדפן אפשר לעקוף. consume_code_download הוא security definer, אטומי (for update),
-- והמונה לעולם לא יורד ולא מתאפס מהדפדפן — אין שום פונקציה שמורידה אותו חוץ מ-admin_gift_dobble (מנהל בלבד).

-- ── 1. עמודות: download_limit (null = ללא הגבלה — כל הקודים הקיימים נשארים כך) ו-download_count ──
alter table public.dobble_access_codes add column if not exists download_limit int;
alter table public.dobble_access_codes add column if not exists download_count int not null default 0;

-- ── 2. יומן הורדות לפי טביעת אצבע (משחק זהה תוך 24 שעות לא נספר שוב) — סגור לגמרי, רק דרך הפונקציות ──
create table if not exists public.dobble_code_downloads (
  id   bigint generated always as identity primary key,
  code text not null,
  fp   text not null,
  at   timestamptz not null default now()
);
create index if not exists dobble_code_downloads_code_fp_at on public.dobble_code_downloads (code, fp, at desc);
alter table public.dobble_code_downloads enable row level security;
revoke all on public.dobble_code_downloads from anon, authenticated;

-- ── 3. צריכת הורדה. נקראת מהמחולל לפני כל ייצוא, למשתמש שנכנס בקוד ──
-- p_fp = טביעת אצבע של המשחק (תמונות + גודל + צורה), מחושבת בדפדפן. אותו משחק שכבר הורד ב-24 השעות האחרונות — ok בלי לספור.
-- תשובות: {ok:true,...} | {ok:false,reason:'download_limit',limit,used}
-- קוד שלא קיים בטבלה (קוד מקומי ישן) או בלי מגבלה → ok (fail-open: חוסמים רק על מגבלה מפורשת).
create or replace function public.consume_code_download(p_code text, p_fp text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rec public.dobble_access_codes%rowtype;
  v_fp text := nullif(left(trim(coalesce(p_fp,'')), 200), '');
begin
  p_code := trim(coalesce(p_code,''));
  select * into rec from public.dobble_access_codes where code = p_code for update;
  if not found or rec.download_limit is null then
    return jsonb_build_object('ok', true, 'limit', null);
  end if;

  -- אותו משחק שהורד ב-24 השעות האחרונות — לא נספר (PDF ואז גיליון / ZIP / חיתוך צורני של אותו משחק)
  if v_fp is not null and exists (
       select 1 from public.dobble_code_downloads
        where code = rec.code and fp = v_fp and at > now() - interval '24 hours') then
    return jsonb_build_object('ok', true, 'same', true, 'limit', rec.download_limit, 'used', rec.download_count,
                              'remaining', greatest(rec.download_limit - rec.download_count, 0));
  end if;

  if rec.download_count >= rec.download_limit then
    return jsonb_build_object('ok', false, 'reason', 'download_limit', 'limit', rec.download_limit, 'used', rec.download_count);
  end if;

  update public.dobble_access_codes set download_count = download_count + 1 where id = rec.id;
  if v_fp is not null then
    insert into public.dobble_code_downloads (code, fp) values (rec.code, v_fp);
  end if;
  return jsonb_build_object('ok', true, 'limit', rec.download_limit, 'used', rec.download_count + 1,
                            'remaining', rec.download_limit - rec.download_count - 1);
end $$;

-- ── 4. מצב בלבד (לשורה "נשארו לך X הורדות" בשלב 3) — לא סופר ולא משנה כלום ──
create or replace function public.code_download_status(p_code text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when c.download_limit is null then jsonb_build_object('limit', null)
                 else jsonb_build_object('limit', c.download_limit, 'used', c.download_count,
                                         'remaining', greatest(c.download_limit - c.download_count, 0)) end
       from public.dobble_access_codes c where c.code = trim(coalesce(p_code,''))),
    jsonb_build_object('limit', null));
$$;

revoke all on function public.consume_code_download(text,text) from public;
revoke all on function public.code_download_status(text) from public;
grant execute on function public.consume_code_download(text,text) to anon, authenticated;
grant execute on function public.code_download_status(text) to anon, authenticated;

-- ── 5. מתנה ממרכז הניהול (מנהל בלבד — נבדק בשרת לפי ה-JWT) ──
-- p_tier: 13/21/31/57 · p_days: 7/30/90/365 · p_downloads: 1/3/5 או null (ללא הגבלה)
-- מייל שכבר יש לו קוד פעיל → אותו קוד משודרג (max_order הגבוה, תפוגה מוארכת), כמו claim_access_code.
-- ⛔ לא מקטינים מגבלה קיימת: קוד שכבר בלי הגבלה ושהוא מסלול בתשלום (max_order>7) נשאר בלי הגבלה;
--    קוד חינמי (max_order≤7, "ללא הגבלה" רק על 7 קלפים) מקבל את מגבלת המתנה; קוד עם מגבלה — המגבלה רק גדלה.
create or replace function public.admin_gift_dobble(p_email text, p_tier int, p_days int, p_downloads int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  owned  public.dobble_access_codes%rowtype;
  v_code text;
  v_exp  timestamptz;
  v_max  int;
  v_lim  int;
  v_ext  boolean := false;
begin
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'hoshaya@gmail.com' then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  p_email := lower(trim(coalesce(p_email,'')));
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_email');
  end if;
  if p_tier not in (13,21,31,57) then
    return jsonb_build_object('ok', false, 'reason', 'bad_tier');
  end if;
  if p_days not in (7,30,90,365) then
    return jsonb_build_object('ok', false, 'reason', 'bad_days');
  end if;
  if p_downloads is not null and p_downloads not in (1,3,5) then
    return jsonb_build_object('ok', false, 'reason', 'bad_downloads');
  end if;

  select * into owned from public.dobble_access_codes
   where lower(coalesce(created_for,'')) = p_email and is_active
     and (expires_at is null or expires_at > now())
   order by created_at asc limit 1 for update;

  if found then
    v_ext  := true;
    v_code := owned.code;
    v_max  := greatest(coalesce(owned.max_order,7), p_tier);
    -- קוד בלי תפוגה (גישה מלאה ישנה) נשאר בלי תפוגה
    v_exp  := case when owned.expires_at is null then null
                   else greatest(owned.expires_at, now()) + make_interval(days => p_days) end;
    v_lim  := case
                when owned.download_limit is null and coalesce(owned.max_order,7) > 7 then null   -- מסלול בתשלום: נשאר בלי הגבלה
                when p_downloads is null then null                                                 -- מתנה בלי הגבלה
                when owned.download_limit is null then p_downloads                                 -- קוד חינמי: מגבלת המתנה
                else greatest(owned.download_limit, owned.download_count + p_downloads)            -- רק גדל
              end;
    update public.dobble_access_codes
       set max_order = v_max, expires_at = v_exp, download_limit = v_lim
     where id = owned.id;
  else
    -- קוד חדש: 6 תווים בלי אותיות/ספרות שמתבלבלות (0/O, 1/I/L)
    loop
      v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '')
                   from generate_series(1,6));
      exit when not exists (select 1 from public.dobble_access_codes where code = v_code);
    end loop;
    v_max := p_tier;
    v_exp := now() + make_interval(days => p_days);
    v_lim := p_downloads;
    insert into public.dobble_access_codes (code, type, max_order, expires_at, created_for, is_active, download_limit)
    values (v_code, 'pass', v_max, v_exp, p_email, true, v_lim);
  end if;

  insert into public.dobble_transactions (provider, customer_email, amount, status, tier, claimed_at, claimed_code, raw_payload)
  values ('gift', p_email, 0, 'paid', p_tier, now(), v_code,
          jsonb_build_object('days', p_days, 'downloads', p_downloads, 'note', nullif(trim(coalesce(p_note,'')),''), 'extended', v_ext));

  return jsonb_build_object('ok', true, 'code', v_code, 'max_order', v_max, 'expires_at', v_exp,
                            'extended', v_ext, 'download_limit', v_lim);
end $$;

create or replace function public.admin_list_dobble_gifts()
returns table (created_at timestamptz, email text, tier int, days int, note text, code text, extended boolean,
               expires_at timestamptz, download_limit int, download_count int)
language sql stable security definer set search_path = public as $$
  select t.created_at, t.customer_email, t.tier, (t.raw_payload->>'days')::int, t.raw_payload->>'note',
         t.claimed_code, coalesce((t.raw_payload->>'extended')::boolean, false), c.expires_at,
         c.download_limit, c.download_count
    from public.dobble_transactions t
    left join public.dobble_access_codes c on c.code = t.claimed_code
   where t.provider = 'gift' and lower(coalesce(auth.jwt() ->> 'email','')) = 'hoshaya@gmail.com'
   order by t.created_at desc limit 15;
$$;

revoke all on function public.admin_gift_dobble(text,int,int,int,text) from public, anon;
revoke all on function public.admin_list_dobble_gifts() from public, anon;
grant execute on function public.admin_gift_dobble(text,int,int,int,text) to authenticated;
grant execute on function public.admin_list_dobble_gifts() to authenticated;
