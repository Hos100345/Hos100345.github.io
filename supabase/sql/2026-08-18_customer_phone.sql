-- כלי ניהול לקוחות — טלפון + אינדקסים לחיפוש. הורץ בפועל דרך MCP ב-18.8.2026.
-- הקובץ כאן לתיעוד/היסטוריה בלבד.
alter table dobble_transactions add column if not exists customer_phone text;

-- backfill מהתשלומים הקיימים: Morning שולח payer.phone בכל webhook,
-- והוא כבר יושב ב-raw_payload מאז היום הראשון. ספרות בלבד.
update dobble_transactions
   set customer_phone = nullif(regexp_replace(coalesce(raw_payload->'payer'->>'phone',''),'\D','','g'),'')
 where customer_phone is null;

create index if not exists idx_tx_phone on dobble_transactions(customer_phone);
create index if not exists idx_tx_email_lower on dobble_transactions(lower(customer_email));
create index if not exists idx_codes_created_for on dobble_access_codes(lower(created_for));
