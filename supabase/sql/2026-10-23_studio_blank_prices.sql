-- S-69 (23/10/2026) — מחיר קבוע למוצרים מוכנים מזיקית. כבר רץ במסד (סשן האתר, MCP). תיעוד בלבד.
create table if not exists public.studio_blank_prices(key text primary key, label text not null, price int not null check(price between 1 and 2000), sort int default 0, updated_at timestamptz default now());
alter table public.studio_blank_prices enable row level security;
create policy studio_blank_prices_read on public.studio_blank_prices for select to anon, authenticated using (true);
create policy studio_blank_prices_admin_update on public.studio_blank_prices for update to authenticated using ((auth.jwt()->>'email')='hoshaya@gmail.com') with check ((auth.jwt()->>'email')='hoshaya@gmail.com');
-- מחירים התחלתיים (הושעיה: "תשים מחיר בינתיים", 23/10): פאזל קרטון 45, A4 מעמד 49, A3 69, עץ A4 89, עץ A3 129, דומינו עץ 149, טנגרם 69, לודו 149 / חיילים 79 / לוח 119
create or replace function public.studio_blank_key(p_product text, s jsonb) returns text language sql immutable as $$
  select case
    when p_product='puzzle' and coalesce(s->>'blank','diy')<>'diy' then
      'puzzle-'||case when s->>'blank' like '9321-%' then '9321' when s->>'blank' like '9331-%' then '9331' when s->>'blank'='9313-60' then '9313-80' else s->>'blank' end
    when p_product='domino' and s->>'blank'='8801' and coalesce(s->>'variant','classic')<>'tri' then 'domino-8801'
    when p_product='tangram' and coalesce(s->>'mode','blank')='blank' then 'tangram-8811'
    when p_product='ludo' and coalesce(s->>'mode','blank')='blank' then 'ludo-8805-'||coalesce(nullif(s->>'what',''),'all')
  end $$;
-- create_studio_order: אם studio_blank_key מחזיר מפתח עם מחיר — המחיר הזה; אחרת studio_price כמו קודם.
