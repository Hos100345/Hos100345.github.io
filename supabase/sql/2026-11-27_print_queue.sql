-- S-209: שרשרת הדפסה — תור עבודות + מחשבי הדפסה (סוכן Windows). אידמפוטנטי.
-- מנהל (hoshaya@gmail.com) קורא/כותב ישירות (RLS כמו studio_orders). הסוכן מדבר רק עם Edge Function print-queue (טוקן → sha256 בטבלה).
create table if not exists public.print_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  active boolean not null default true,
  dry_run boolean not null default true,      -- true = רק מוריד לתיקייה, לא מדפיס
  printer text,                                -- שם המדפסת ב-Windows (נבחר מהרשימה שהסוכן מדווח)
  last_seen timestamptz,
  info jsonb not null default '{}'::jsonb,     -- {printers:[...], host, ver}
  created_at timestamptz not null default now()
);
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.studio_orders(id) on delete cascade,
  code text,
  file text not null default 'print.pdf',
  copies int not null default 1 check (copies between 1 and 50),
  status text not null default 'queued' check (status in ('queued','claimed','downloaded','printed','failed','cancelled')),
  error text,
  attempts int not null default 0,
  agent_id uuid references public.print_agents(id) on delete set null,
  claimed_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists print_jobs_status_idx on public.print_jobs (status, created_at);
alter table public.print_agents enable row level security;
alter table public.print_jobs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='print_agents' and policyname='admin all print agents') then
    create policy "admin all print agents" on public.print_agents for all to authenticated
      using (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com') with check (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com');
  end if;
  if not exists (select 1 from pg_policies where tablename='print_jobs' and policyname='admin all print jobs') then
    create policy "admin all print jobs" on public.print_jobs for all to authenticated
      using (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com') with check (lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com');
  end if;
end $$;
-- לקיחת העבודה הבאה — אטומית (שני סוכנים לא לוקחים אותה עבודה). עבודה שנלקחה ולא דווחה תוך 15 דק' חוזרת לתור.
create or replace function public.print_claim(p_agent uuid)
returns setof public.print_jobs language sql security definer set search_path = public as $$
  update public.print_jobs j set status='claimed', agent_id=p_agent, claimed_at=now(), attempts=j.attempts+1
   where j.id = (select id from public.print_jobs
                  where (status='queued' or (status='claimed' and claimed_at < now()-interval '15 minutes')) and attempts < 5
                  order by created_at limit 1 for update skip locked)
  returning j.*;
$$;
revoke all on function public.print_claim(uuid) from public, anon, authenticated;

-- S-209 (המשך): גליל אחד מכמה הזמנות — העבודה זוכרת את ההזמנות שבתוכה; המנהל מעלה את קובץ הגליל ל-studio-orders/batch/
alter table public.print_jobs add column if not exists order_ids uuid[];
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='admin upload studio print batches') then
    create policy "admin upload studio print batches" on storage.objects for insert to authenticated
      with check (bucket_id='studio-orders' and name like 'batch/%' and lower(coalesce(auth.jwt()->>'email',''))='hoshaya@gmail.com');
  end if;
end $$;
-- S-209: לכל עבודה חומר (עץ/מתכת/זכוכית/זכוכית מהגב/ספלים/בד/אחר) — ולכל מחשב מדפסת קבועה לכל חומר (פרופיל ומראה בדרייבר)
alter table public.print_jobs add column if not exists material text not null default 'other';
alter table public.print_agents add column if not exists printers jsonb not null default '{}'::jsonb;
