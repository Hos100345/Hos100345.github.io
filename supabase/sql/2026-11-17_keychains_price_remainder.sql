-- S-155: מי שמזמין דף שלם ומעלה מקבל 10 ₪ לכל מחזיק (גם בשארית). פחות מדף: min(q*15, n*10).
create or replace function public.studio_keychain_price(p_shape text, p_qty int) returns int
language sql immutable as $$
  with t as (select case p_shape when 'kc-rect' then 9 when 'kc-h5' then 15 else 12 end as n,
                    least(greatest(coalesce(p_qty,1),1),200) as q)
  select case when q >= n then q * 10 else least(q * 15, n * 10) end from t
$$;
