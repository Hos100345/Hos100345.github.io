-- S-154: הזמנת מחזיקי מפתחות מהסטודיו. מחיר: מחזיק בודד 15 ₪; בדף שבלונה מלא (n מחזיקים לפי הצורה) 10 ₪ למחזיק. המבצע הכללי/קוד הנחה חלים אחר כך כרגיל.
alter table studio_orders drop constraint studio_orders_product_check;
alter table studio_orders add constraint studio_orders_product_check check (product = any (array['stickers','cards','memory','quartets','domino','dice','puzzle','bingo','tangram','ludo','tshirt','mug','subl','snakes','keychains']));

-- n = כמה מחזיקים נכנסים בשבלונת A4 של הצורה (חייב להתאים ל-kcLayout בסטודיו)
create or replace function public.studio_keychain_price(p_shape text, p_qty int) returns int
language sql immutable as $$
  with t as (select case p_shape when 'kc-rect' then 9 when 'kc-h5' then 15 else 12 end as n, least(greatest(coalesce(p_qty,1),1),200) as q)
  select (q / n) * n * 10 + least(n * 10, (q % n) * 15) from t
$$;

CREATE OR REPLACE FUNCTION public.create_studio_order(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_phone text := p->>'customer_phone'; v_count int; v_id uuid; v_code text; v_sheets int := (p->>'sheets')::int; v_product text := p->>'product'; v_units int; v_price int; v_key text;
  v_cp text := upper(trim(coalesce(p->>'coupon',''))); v_pct int; v_before int; v_qty int; v_st jsonb := p->'design'->'state';
  v_sale int; v_sale_title text;
begin
  if v_phone is null or v_phone = '' then raise exception 'invalid_phone' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(v_phone), 818);
  select count(*) into v_count from studio_orders where customer_phone = v_phone and created_at > now() - interval '24 hours';
  if v_count >= 5 then raise exception 'rate_limited' using errcode='P0001'; end if;
  if v_product = 'tshirt' then
    select coalesce(sum(least(greatest(coalesce((r->>'qty')::int,0),0),99)),0) into v_qty from jsonb_array_elements(case when jsonb_typeof(v_st->'order')='array' then v_st->'order' else '[]'::jsonb end) r;
    if v_qty < 1 or v_qty > 300 then raise exception 'invalid_qty' using errcode='P0001'; end if;
    select price * v_qty into v_price from studio_blank_prices where key = case when coalesce(v_st->>'backUsed','false')='true' then 'tshirt-both' else 'tshirt-front' end;
  elsif v_product = 'mug' then
    -- S-91: ספל — מחיר ליחידה מ-studio_blank_prices (mug-8501 / mug-8517) × כמות. אין שורה = הצעת מחיר (0)
    v_qty := least(greatest(coalesce(nullif(v_st->>'qty','')::int,1),1),99);
    select price * v_qty into v_price from studio_blank_prices where key = 'mug-' || case when v_st->>'type' = '8517' then '8517' else '8501' end;
  elsif v_product = 'subl' then
    -- S-120: מתנות מזיקית — מחיר ליחידה (subl-<מק"ט>, עלות ×4) × כמות. אין שורה = הצעת מחיר (0)
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
  -- S-139: מבצע כללי (studio_sales) חל לבד. קוד הנחה לא מצטבר איתו — הלקוח מקבל את הגבוה מהשניים, וקוד שלא נוצל לא נספר.
  select percent, title into v_sale, v_sale_title from studio_sales where active and now() >= starts_at and now() <= ends_at order by percent desc limit 1;
  if v_cp <> '' and v_price > 0 then
    select percent into v_pct from studio_coupons where code = v_cp and active
      and (starts_at is null or now() >= starts_at) and (ends_at is null or now() <= ends_at)
      and (max_uses is null or uses < max_uses) for update;
  end if;
  if v_pct is not null and v_pct > coalesce(v_sale,0) then
    update studio_coupons set uses = uses + 1 where code = v_cp;
    v_sale_title := null;
  else
    v_cp := ''; v_pct := v_sale;
  end if;
  if v_pct is not null and v_price > 0 then
    v_before := v_price; v_price := round(v_price * (100 - v_pct) / 100.0);
  else
    v_sale_title := null;
  end if;
  insert into studio_orders (product, customer_name, customer_phone, customer_note, sheets, price_ils, design, summary, coupon, price_before)
  values (v_product, nullif(p->>'customer_name',''), v_phone, nullif(p->>'customer_note',''), v_sheets,
          v_price, p->'design', nullif(p->>'summary',''), nullif(v_cp,''), v_before)
  returning id, code into v_id, v_code;
  return jsonb_build_object('id', v_id, 'code', v_code, 'price', v_price, 'price_before', v_before, 'coupon', nullif(v_cp,''), 'sale', v_sale_title);
end $function$;
