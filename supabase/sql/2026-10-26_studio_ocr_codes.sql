-- S-88: קודי גישה למחלץ הטקסט (נפרס ב-26/10/2026 דרך MCP)
create table if not exists public.studio_ocr_codes(
  code text primary key check (length(code) between 6 and 20),
  label text not null default '',
  used int not null default 0,
  usage_limit int,
  price_per_page numeric not null default 1,
  paid_pages int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists public.studio_ocr_log(
  id bigint generated always as identity primary key,
  code text, ok boolean not null, model text, ms int, error text,
  created_at timestamptz not null default now()
);
create index if not exists studio_ocr_log_code_idx on public.studio_ocr_log(code, created_at desc);
alter table public.studio_ocr_codes enable row level security;
alter table public.studio_ocr_log enable row level security;
create policy studio_ocr_codes_admin_all on public.studio_ocr_codes for all to authenticated
  using (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com') with check (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com');
create policy studio_ocr_log_admin_read on public.studio_ocr_log for select to authenticated
  using (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com');
grant select on public.studio_ocr_codes, public.studio_ocr_log to anon;
grant select, insert, update, delete on public.studio_ocr_codes, public.studio_ocr_log to authenticated;
grant select, insert, update, delete on public.studio_ocr_codes, public.studio_ocr_log to service_role;
create or replace function public.studio_ocr_consume(p_code text) returns int
language sql security definer set search_path=public as $$
  update studio_ocr_codes set used=used+1, last_used_at=now()
  where code=p_code and active and (expires_at is null or expires_at>now()) and (usage_limit is null or used<usage_limit)
  returning used;
$$;
revoke all on function public.studio_ocr_consume(text) from public, anon, authenticated;
grant execute on function public.studio_ocr_consume(text) to service_role;
