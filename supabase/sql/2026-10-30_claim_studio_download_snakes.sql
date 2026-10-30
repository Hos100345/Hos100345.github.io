-- S-103 (30/10/2026): הורדה בתשלום (10 ₪) גם לסולמות וחבלים — לחנות מוצרי המקדש.
-- השינוי היחיד מול הגרסה החיה הקודמת: 'snakes' נוסף לרשימת המוצרים. הורץ על ה-DB דרך MCP.
CREATE OR REPLACE FUNCTION public.claim_studio_download(p_email text, p_product text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare e text := lower(trim(coalesce(p_email,''))); tx record; g record;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok',false,'error','bad_email'); end if;
  if p_product not in ('cards','memory','quartets','domino','dice','puzzle','stickers','bingo','tangram','ludo','snakes') then return jsonb_build_object('ok',false,'error','bad_product'); end if;
  select id into g from studio_grants where lower(email)=e and used_at is null order by created_at limit 1 for update;
  if g.id is not null then
    update studio_grants set used_at=now(), used_product=p_product where id=g.id;
    insert into studio_downloads(external_id,email,product,amount) values ('grant-'||g.id,e,p_product,0);
    return jsonb_build_object('ok',true,'grant',true);
  end if;
  select t.external_id, t.amount into tx from dobble_transactions t
   where t.raw_payload->>'productId' = '61739b91-a9a5-449e-bb40-071faede9079'
     and lower(t.customer_email) = e and coalesce(t.amount,0) >= 10
     and t.created_at > now() - interval '30 days'
     and not exists (select 1 from studio_downloads d where d.external_id = t.external_id)
   order by t.created_at limit 1 for update;
  if tx.external_id is null then return jsonb_build_object('ok',false,'error','no_payment'); end if;
  insert into studio_downloads(external_id,email,product,amount) values (tx.external_id,e,p_product,tx.amount);
  return jsonb_build_object('ok',true);
end $function$;
