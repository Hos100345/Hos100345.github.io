-- ============================================================
-- סטודיו הדפסה וחיתוך — הזמנות (studio.html)
-- הורץ ב-27/09/2026 דרך MCP (execute_sql). כאן לתיעוד בלבד — כבר קיים ב-DB.
-- ============================================================
create sequence if not exists public.studio_order_seq;
create table if not exists public.studio_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ST-' || lpad(nextval('public.studio_order_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  product text not null check (product in ('stickers','cards','memory','domino','dice','puzzle')),
  customer_name text,
  customer_phone text not null,
  customer_note text,
  sheets int not null check (sheets between 1 and 40),
  price_ils int not null,
  design jsonb not null,
  summary text,
  status text not null default 'uploading' check (status in ('uploading','new','in_progress','done','cancelled')),
  files jsonb not null default '[]'::jsonb,
  paid boolean not null default false,
  payment_ref text,
  printed boolean not null default false,
  admin_note text
);
alter table public.studio_orders enable row level security;
create policy "admin read studio orders" on public.studio_orders for select using (lower(coalesce(auth.jwt()->>'email','')) = 'hoshaya@gmail.com');
create policy "admin update studio orders" on public.studio_orders for update using (lower(coalesce(auth.jwt()->>'email','')) = 'hoshaya@gmail.com');
create policy "admin delete studio orders" on public.studio_orders for delete using (lower(coalesce(auth.jwt()->>'email','')) = 'hoshaya@gmail.com');

-- מחירון — בצד השרת בלבד. מדבקות 15 לדף, דפים עבים 30 לדף, פאזל 50 לפאזל.
create or replace function public.studio_price(p_product text, p_sheets int) returns int
language sql immutable as $$
  select case p_product
    when 'stickers' then 15 * p_sheets
    when 'puzzle'   then 50 * p_sheets
    when 'cards'    then 30 * p_sheets
    when 'memory'   then 30 * p_sheets
    when 'domino'   then 30 * p_sheets
    when 'dice'     then 30 * p_sheets
  end $$;

create or replace function public.create_studio_order(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_phone text := p->>'customer_phone'; v_count int; v_id uuid; v_code text; v_sheets int := (p->>'sheets')::int; v_product text := p->>'product'; v_units int;
begin
  if v_phone is null or v_phone = '' then raise exception 'invalid_phone' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(v_phone), 818);
  select count(*) into v_count from studio_orders where customer_phone = v_phone and created_at > now() - interval '24 hours';
  if v_count >= 5 then raise exception 'rate_limited' using errcode='P0001'; end if;
  v_units := case when v_product = 'puzzle' then 1 else v_sheets end;
  insert into studio_orders (product, customer_name, customer_phone, customer_note, sheets, price_ils, design, summary)
  values (v_product, nullif(p->>'customer_name',''), v_phone, nullif(p->>'customer_note',''), v_sheets,
          studio_price(v_product, v_units), p->'design', nullif(p->>'summary',''))
  returning id, code into v_id, v_code;
  return jsonb_build_object('id', v_id, 'code', v_code, 'price', studio_price(v_product, v_units));
end $$;
revoke all on function public.create_studio_order(jsonb) from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-orders','studio-orders', false, 26214400, array['application/pdf','image/svg+xml','application/zip','image/jpeg'])
on conflict (id) do nothing;
create policy "admin read studio order files" on storage.objects for select using (bucket_id = 'studio-orders' and lower(coalesce(auth.jwt()->>'email','')) = 'hoshaya@gmail.com');
create policy "admin delete studio order files" on storage.objects for delete using (bucket_id = 'studio-orders' and lower(coalesce(auth.jwt()->>'email','')) = 'hoshaya@gmail.com');
