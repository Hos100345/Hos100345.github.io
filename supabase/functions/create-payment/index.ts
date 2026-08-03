// create-payment — יוצר דרישת תשלום ב-Morning לפי הרמה שנבחרה, ומחזיר קישור תשלום.
const GI_BASE = "https://api.greeninvoice.co.il/api/v1";

// מדרגות המחיר: מספר קלפים → מחיר בש"ח
const TIERS: Record<number, number> = { 13: 5, 21: 10, 31: 12, 57: 15 };

const SUCCESS_URL = "https://hos100345.github.io/dobble.html?paid=1";
const FAILURE_URL = "https://hos100345.github.io/dobble.html?paid=0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function getMorningToken(): Promise<string> {
  const res = await fetch(`${GI_BASE}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: Deno.env.get("GI_API_KEY"), secret: Deno.env.get("GI_API_SECRET") }),
  });
  if (!res.ok) throw new Error("morning_token_failed");
  const data = await res.json();
  return data.token ?? data?.data?.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* גוף ריק מותר */ }

  const email = (typeof body.email === "string" ? body.email.trim() : "") || undefined;
  const tier = Number(body.tier);

  if (!TIERS[tier]) {
    return json({ error: "bad_tier", allowed: Object.keys(TIERS) }, 400);
  }
  const price = TIERS[tier];
  const description = `מנוי דובל — עד ${tier} קלפים`;

  try {
    const token = await getMorningToken();

    const payload: Record<string, unknown> = {
      type: 320,
      lang: "he",
      currency: "ILS",
      vatType: 0,
      amount: price,
      client: { name: email ?? "לקוח", emails: email ? [email] : [], add: true },
      income: [{ description, quantity: 1, price, currency: "ILS", vatType: 0 }],
      remarks: `dobble tier ${tier}`,
      successUrl: `${SUCCESS_URL}&tier=${tier}`,
      failureUrl: FAILURE_URL,
    };

    const res = await fetch(`${GI_BASE}/payments/form`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("form error", res.status, JSON.stringify(data));
      return json({ error: "form_failed", status: res.status, detail: data }, 502);
    }

    const url = (data as any).url ?? (data as any)?.data?.url ?? (data as any).form ?? null;
    if (!url) {
      console.error("no url in response", JSON.stringify(data));
      return json({ error: "no_url", raw: data }, 502);
    }
    return json({ url, tier, price }, 200);
  } catch (e) {
    console.error("create-payment error:", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
