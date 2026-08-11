-- ai-gateway v1 — טבלת מעקב שימוש ומכסות
-- להריץ ידנית דרך MCP (execute_sql) בסשן Claude.ai. לא רץ אוטומטית.

create table if not exists public.ai_usage (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  action        text not null,
  model         text not null,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  ok            boolean not null default true,
  err           text,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_user_day_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- המשתמש רואה רק את השימוש של עצמו; כתיבה רק דרך service_role (מה-Edge Function)
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select using (auth.uid() = user_id);
-- אין policy ל-INSERT/UPDATE/DELETE בכוונה. service_role עוקף RLS.

-- פונקציית בדיקת מכסה יומית
create or replace function public.ai_quota_left(p_user uuid, p_limit int)
returns int
language sql
security definer
set search_path = public
as $$
  select greatest(0, p_limit - count(*)::int)
  from public.ai_usage
  where user_id = p_user
    and ok = true
    and created_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem')
                      at time zone 'Asia/Jerusalem';
$$;

revoke all on function public.ai_quota_left(uuid,int) from public, anon, authenticated;
