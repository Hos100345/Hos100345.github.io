-- קאש תרגומים עברית→אנגלית עבור image-gateway.
-- נוצר ב-17.8.2026 דרך MCP. הקובץ כאן לתיעוד בלבד.
create table if not exists ai_translation_cache (
  source_he  text primary key,
  english    text not null,
  hits       int not null default 0,
  created_at timestamptz not null default now()
);

alter table ai_translation_cache enable row level security;

create policy "admin reads translation cache" on ai_translation_cache
  for select using (auth.jwt() ->> 'email' = 'hoshaya@gmail.com');
