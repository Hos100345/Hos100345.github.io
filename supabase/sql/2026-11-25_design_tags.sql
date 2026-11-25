-- W-76: תיוגים בספריית העיצובים ("למי זה מתאים?" — בן, בת, בוס, יפה… + תיוגים חופשיים).
-- כל תיוג = הצבעה של מכשיר אחד (who_hash) על עיצוב אחד. design_library.tags = {תיוג: כמה תייגו}, מתעדכן ב-trigger.
-- כתיבה רק דרך הפונקציה design-library (service_role). אידמפוטנטי.
create table if not exists public.design_tag_votes (
  design_id uuid not null references public.design_library (id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 24),
  who_hash text not null,
  created_at timestamptz not null default now(),
  primary key (design_id, tag, who_hash)
);
alter table public.design_tag_votes enable row level security;
revoke all on public.design_tag_votes from anon, authenticated;

alter table public.design_library add column if not exists tags jsonb not null default '{}'::jsonb;
create index if not exists design_library_tags_idx on public.design_library using gin (tags);

create or replace function public.design_tags_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
declare d uuid := coalesce(new.design_id, old.design_id);
begin
  update public.design_library l
     set tags = coalesce((select jsonb_object_agg(t.tag, t.n) from (select tag, count(*) n from public.design_tag_votes v where v.design_id = d group by tag) t), '{}'::jsonb)
   where l.id = d;
  return null;
end $$;
revoke all on function public.design_tags_recalc() from public, anon, authenticated;
drop trigger if exists design_tags_recalc_trg on public.design_tag_votes;
create trigger design_tags_recalc_trg after insert or delete on public.design_tag_votes
  for each row execute function public.design_tags_recalc();
