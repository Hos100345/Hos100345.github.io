-- מחולל סמלים ב-AI — שלב 0 (מנהל בלבד)
-- להריץ ידנית דרך MCP (execute_sql) בסשן Claude.ai. לא רץ אוטומטית.

insert into storage.buckets (id, name, public)
values ('ai-symbols', 'ai-symbols', false)
on conflict (id) do nothing;

create table if not exists ai_image_log (
  cache_key    text primary key,        -- sha256(prompt|seed|size), 32 תווים
  prompt       text not null,
  subject_he   text,
  style        text not null,
  seed         int  not null,
  storage_path text not null,
  provider     text not null default 'pollinations',
  est_cost_usd numeric(10,5) not null default 0,
  hits         int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table ai_image_log enable row level security;

-- קריאה למנהל בלבד, בתבנית של events. כתיבה רק דרך service_role (מ-image-gateway) — אין policy למשתמש.
create policy "admin reads log" on ai_image_log for select
  using (auth.jwt() ->> 'email' = 'hoshaya@gmail.com');
