// morning-webhook — payment/received מ-Morning, מוקשח.
// מסמן "שולם" רק אם ה-productId מוכר (לינק Dobble אמיתי) והסכום תואם למדרגה.
// כל דבר אחר → pending (לא מעניק גישה). תמיד מחזיר 200.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Allowlist של לינקי התשלום לפי מדרגה: productId -> סכום צפוי + מדרגה.
// הוספת מדרגה/לינק חדש = הוסף שורה כאן.
const LINKS: Record<string, { amount: number; tier: number }> = {
  "98c5798e-ab56-436d-9788-021a41e1a0e3": { amount: 5,  tier: 13 },
  "a6c11d6f-e388-4447-89f7-561d1fc17738": { amount: 10, tier: 21 },
  "a44d8cdf-6761-4e51-82cb-ef724ea7cf9f": { amount: 12, tier: 31 },
  "19b4d840-afa3-4019-a10f-687fb3bd2e52": { amount: 15, tier: 57 },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const hdrs: Record<string, string> = {};
  req.headers.forEach((v, k) => { hdrs[k] = v; });
  console.log("HEADERS=", JSON.stringify(hdrs));

  let payload: any = {};
  let rawText = "";
  try {
    rawText = await req.text();
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    console.error("BAD_JSON raw=", rawText);
    return new Response("ok", { status: 200 });
  }
  console.log("RAW_PAYLOAD=", JSON.stringify(payload));

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const p = payload;
  const txArr = Array.isArray(p.transactions) ? p.transactions : [];
  const firstTx = txArr[0] ?? {};

  const email: string | null = p.payer?.email ?? firstTx?.payer?.email ?? null;
  const amount: number | null =
    (typeof p.total === "number" ? p.total : null) ??
    (typeof firstTx?.total === "number" ? firstTx.total : null);
  const productId: string | null = p.productId ?? null;
  const extId: string = String(p.id ?? firstTx?.gatewayTransactionId ?? firstTx?.id ?? ("noid_" + Date.now()));

  const known = productId ? LINKS[productId] : null;

  let status = "pending";
  let tier: number | null = null;

  if (known && email && amount != null && Number(amount) === known.amount) {
    status = "paid";
    tier = known.tier;
  } else {
    console.error("NOT_PAID productId=", productId, "amount=", amount, "email=", email, "known=", JSON.stringify(known));
  }

  console.log("RESULT status=", status, "tier=", tier, "email=", email, "amount=", amount, "extId=", extId);

  try {
    const { error } = await supabase.from("dobble_transactions").upsert({
      provider: "morning",
      external_id: extId,
      customer_email: email ? String(email).toLowerCase().trim() : null,
      amount,
      tier,
      currency: "ILS",
      status,
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "external_id" });
    if (error) console.error("UPSERT_ERROR", JSON.stringify(error));
    else console.log("UPSERT_OK");
  } catch (e) {
    console.error("UPSERT_THROW", String(e));
  }

  return new Response("ok", { status: 200 });
});
