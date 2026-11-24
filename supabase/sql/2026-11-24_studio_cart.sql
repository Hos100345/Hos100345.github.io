-- S-188: סל קניות בסטודיו — כמה מוצרים בהזמנה אחת. ⛔ טרם הורץ — להריץ (execute_sql) רק אחרי אישור הושעיה, ולפני פריסת studio-order שכוללת action=cart.
-- כל מוצר בסל נשאר שורה רגילה ב-studio_orders (אותו מחיר, אותם קבצים, אותן פעולות מנהל), עם cart_code משותף (CART-0001…).
-- הגבלת הקצב (5 ביום לטלפון) סופרת "יחידות": הזמנה בודדת = 1, סל שלם = 1 — גם בהזמנה בודדת אחרי סל, וגם בסל אחרי הזמנות בודדות.
-- קוד הנחה בסל: חל על כל המוצרים (כל אחד מקבל את האחוז — כמו הנחה על הסה"כ), ונספר כשימוש אחד בלבד.
-- create_studio_order: הגוף זהה לגרסה החיה (נבדק מול pg_get_functiondef ב-24/11/2026) + שלושה שינויים מסומנים "S-188".

alter table public.studio_orders add column if not exists cart_code text;
create index if not exists studio_orders_cart_code_idx on public.studio_orders (cart_code) where cart_code is not null;
create index if not exists studio_orders_phone_created_idx on public.studio_orders (customer_phone, created_at);
create sequence if not exists public.studio_cart_seq;

CREATE OR REPLACE FUNCTION public.create_studio_order(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_phone text := p->>'customer_phone'; v_count int; v_id uuid; v_code text; v_sheets int := (p->>'sheets')::int; v_product text := p->>'product'; v_units int; v_price int; v_key text;
  v_cp text := upper(trim(coalesce(p->>'coupon',''))); v_pct int; v_before int; v_qty int; v_st jsonb := p->'design'->'state';
  v_sale int; v_sale_title text;
  v_cart text := nullif(trim(coalesce(p->>'cart_code','')),''); -- S-188: נקבע רק ב-create_studio_cart (הפונקציה הזו פתוחה ל-service_role בלבד)
begin
  if v_phone is null or v_phone = '' then raise exception 'invalid_phone' using errcode='P0001'; end if;
  -- S-188: בתוך סל ההגבלה כבר נבדקה פעם אחת לכל הסל (create_studio_cart). יחידה = הזמנה בודדת או סל שלם
  if v_cart is null then
    perform pg_advisory_xact_lock(hashtext(v_phone), 818);
    select count(distinct coalesce(cart_code, id::text)) into v_count from studio_orders where customer_phone = v_phone and created_at > now() - interval '24 hours';
    if v_count >= 5 then raise exception 'rate_limited' using errcode='P0001'; end if;
  end if;
  if v_product = 'tshirt' then
    select coalesce(sum(least(greatest(coalesce((r->>'qty')::int,0),0),99)),0) into v_qty from jsonb_array_elements(case when jsonb_typeof(v_st->'order')='array' then v_st->'order' else '[]'::jsonb end) r;
    if v_qty < 1 or v_qty > 300 then raise exception 'invalid_qty' using errcode='P0001'; end if;
    select price * v_qty into v_price from studio_blank_prices where key = case when coalesce(v_st->>'backUsed','false')='true' then 'tshirt-both' else 'tshirt-front' end;
  elsif v_product = 'mug' then
    v_qty := least(greatest(coalesce(nullif(v_st->>'qty','')::int,1),1),99);
    select price * v_qty into v_price from studio_blank_prices where key = 'mug-' || case when v_st->>'type' = '8517' then '8517' else '8501' end;
  elsif v_product = 'subl' then
    v_qty := least(greatest(coalesce(nullif(v_st->>'qty','')::int,1),1),200);
    select price * v_qty into v_price from studio_blank_prices where key = 'subl-' || coalesce(v_st->>'item','');
  elsif v_product = 'keychains' then
    -- S-154: מחזיקי מפתחות — 15 ₪ ליחיד, 10 ₪ למחזיק בדף שבלונה מלא (studio_keychain_price). הכמות והצורה מהעיצוב, המחיר מהשרת
    v_qty := least(greatest(coalesce(nullif(v_st->>'qty','')::int,1),1),200);
    v_price := studio_keychain_price(coalesce(v_st->>'shape',''), v_qty);
  else
    v_key := studio_blank_key(v_product, v_st);
    if v_key is not null then select price into v_price from studio_blank_prices where key = v_key; end if;
    if v_price is null then
      v_units := case when v_product = 'puzzle' then 1 else v_sheets end;
      v_price := coalesce(studio_price(v_product, v_units),0);
    end if;
  end if;
  v_price := coalesce(v_price,0);
  select percent, title into v_sale, v_sale_title from studio_sales where active and now() >= starts_at and now() <= ends_at order by percent desc limit 1;
  if v_cp <> '' and v_price > 0 then
    select percent into v_pct from studio_coupons where code = v_cp and active
      and (starts_at is null or now() >= starts_at) and (ends_at is null or now() <= ends_at)
      and (max_uses is null or uses < max_uses) for update;
  end if;
  if v_pct is not null and v_pct > coalesce(v_sale,0) then
    -- S-188: בסל — השימוש נספר פעם אחת לכל הסל, ב-create_studio_cart
    if v_cart is null then update studio_coupons set uses = uses + 1 where code = v_cp; end if;
    v_sale_title := null;
  else
    v_cp := ''; v_pct := v_sale;
  end if;
  if v_pct is not null and v_price > 0 then
    v_before := v_price; v_price := round(v_price * (100 - v_pct) / 100.0);
  else
    v_sale_title := null;
  end if;
  insert into studio_orders (product, customer_name, customer_phone, customer_note, sheets, price_ils, design, summary, coupon, price_before, cart_code)
  values (v_product, nullif(p->>'customer_name',''), v_phone, nullif(p->>'customer_note',''), v_sheets,
          v_price, p->'design', nullif(p->>'summary',''), nullif(v_cp,''), v_before, v_cart)
  returning id, code into v_id, v_code;
  return jsonb_build_object('id', v_id, 'code', v_code, 'price', v_price, 'price_before', v_before, 'coupon', nullif(v_cp,''), 'sale', v_sale_title);
end $function$;

-- S-188: סל שלם בטרנזקציה אחת. p = {customer_phone, customer_name, customer_note, coupon, items:[{product, sheets, design, summary}]}
-- מוצר אחד שנכשל (invalid_qty וכו') = שום הזמנה מהסל לא נוצרת.
CREATE OR REPLACE FUNCTION public.create_studio_cart(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_phone text := p->>'customer_phone'; v_items jsonb := p->'items'; v_count int; v_cart text; it jsonb; v_r jsonb;
  v_out jsonb := '[]'::jsonb; v_total int := 0; v_cp_used text;
begin
  if v_phone is null or v_phone = '' then raise exception 'invalid_phone' using errcode='P0001'; end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 10 then
    raise exception 'invalid_items' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(v_phone), 818);
  select count(distinct coalesce(cart_code, id::text)) into v_count from studio_orders where customer_phone = v_phone and created_at > now() - interval '24 hours';
  if v_count >= 5 then raise exception 'rate_limited' using errcode='P0001'; end if;
  v_cart := 'CART-' || lpad(nextval('studio_cart_seq')::text, 4, '0');
  for it in select value from jsonb_array_elements(v_items) loop
    v_r := create_studio_order(jsonb_build_object(
      'product', it->>'product', 'sheets', (it->>'sheets')::int, 'design', it->'design', 'summary', it->>'summary',
      'customer_phone', v_phone, 'customer_name', p->>'customer_name', 'customer_note', p->>'customer_note',
      'coupon', p->>'coupon', 'cart_code', v_cart));
    v_out := v_out || jsonb_build_array(v_r);
    v_total := v_total + coalesce((v_r->>'price')::int, 0);
    if v_r->>'coupon' is not null then v_cp_used := v_r->>'coupon'; end if;
  end loop;
  if v_cp_used is not null then update studio_coupons set uses = uses + 1 where code = v_cp_used; end if;
  return jsonb_build_object('cart_code', v_cart, 'total', v_total, 'items', v_out);
end $function$;

-- כמו create_studio_order: רק ה-Edge Function (service_role) קוראת לה
revoke all on function public.create_studio_cart(jsonb) from public, anon, authenticated;
grant execute on function public.create_studio_cart(jsonb) to service_role;
revoke all on function public.create_studio_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_studio_order(jsonb) to service_role;
