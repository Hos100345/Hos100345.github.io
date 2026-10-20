-- W-49: מתנה במחולל (מאצ׳טו) ממרכז הניהול.
-- הושעיה כותב מייל + מדרגה + משך → הלקוח מקבל קוד גישה מוכן ("יש לי קוד" במחולל).
-- למייל שכבר יש לו קוד פעיל: אותו קוד משודרג (max_order הגבוה מבין השניים) ומוארך —
-- אותו כלל כמו claim_access_code, כדי שלא ייווצרו שני קודים למייל אחד.
-- כל מתנה נרשמת ב-dobble_transactions (provider='gift', amount=0, כבר "ממומשת"),
-- כך שהיא מופיעה בהיסטוריה ולא נתפסת אחר כך ע"י claim_access_code.
-- הרשאה: רק המייל של הושעיה (כמו RLS של studio_grants). הטבלאות עצמן נשארות סגורות.

create or replace function public.admin_gift_dobble(p_email text, p_tier int, p_months int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  owned  public.dobble_access_codes%rowtype;
  v_code text;
  v_exp  timestamptz;
  v_max  int;
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
  if p_months not in (1,3,12) then
    return jsonb_build_object('ok', false, 'reason', 'bad_months');
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
                   else greatest(owned.expires_at, now()) + make_interval(months => p_months) end;
    update public.dobble_access_codes set max_order = v_max, expires_at = v_exp where id = owned.id;
  else
    -- קוד חדש: 6 תווים בלי אותיות/ספרות שמתבלבלות (0/O, 1/I/L)
    loop
      v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '')
                   from generate_series(1,6));
      exit when not exists (select 1 from public.dobble_access_codes where code = v_code);
    end loop;
    v_max := p_tier;
    v_exp := now() + make_interval(months => p_months);
    insert into public.dobble_access_codes (code, type, max_order, expires_at, created_for, is_active)
    values (v_code, 'pass', v_max, v_exp, p_email, true);
  end if;

  insert into public.dobble_transactions (provider, customer_email, amount, status, tier, claimed_at, claimed_code, raw_payload)
  values ('gift', p_email, 0, 'paid', p_tier, now(), v_code,
          jsonb_build_object('months', p_months, 'note', nullif(trim(coalesce(p_note,'')),''), 'extended', v_ext));

  return jsonb_build_object('ok', true, 'code', v_code, 'max_order', v_max, 'expires_at', v_exp, 'extended', v_ext);
end $$;

create or replace function public.admin_list_dobble_gifts()
returns table (created_at timestamptz, email text, tier int, months int, note text, code text, extended boolean, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.created_at, t.customer_email, t.tier, (t.raw_payload->>'months')::int, t.raw_payload->>'note',
         t.claimed_code, coalesce((t.raw_payload->>'extended')::boolean, false), c.expires_at
    from public.dobble_transactions t
    left join public.dobble_access_codes c on c.code = t.claimed_code
   where t.provider = 'gift' and lower(coalesce(auth.jwt() ->> 'email','')) = 'hoshaya@gmail.com'
   order by t.created_at desc limit 15;
$$;

revoke all on function public.admin_gift_dobble(text,int,int,text) from public, anon;
revoke all on function public.admin_list_dobble_gifts() from public, anon;
grant execute on function public.admin_gift_dobble(text,int,int,text) to authenticated;
grant execute on function public.admin_list_dobble_gifts() to authenticated;
