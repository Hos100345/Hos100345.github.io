// =====================================================
// ai-client.js — לקוח פרונט משותף ל-ai-gateway.
// קובץ עצמאי, בלי לוגיקת רביעיות/דאבל — כל מחולל עתידי מייבא אותו.
// functionsUrl לדוגמה: `${SUPABASE_CONFIG.url}/functions/v1`
// =====================================================

export function createAIClient(supabase, functionsUrl) {
  return {
    async call(action, payload, opts = {}) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new AIError("auth", "צריך להתחבר כדי להשתמש ביצירה אוטומטית.");

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 90000);
      try {
        const r = await fetch(`${functionsUrl}/ai-gateway`, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, payload, tier: opts.tier }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new AIError(j.error || "http_" + r.status, j.message || "היצירה נכשלה. נסה שוב.");
        return j.result;
      } catch (e) {
        if (e.name === "AbortError") throw new AIError("timeout", "היצירה לקחה יותר מדי זמן. נסה נושא ממוקד יותר.");
        throw e;
      } finally { clearTimeout(t); }
    }
  };
}

export class AIError extends Error {
  constructor(code, msg) { super(msg); this.code = code; this.name = "AIError"; }
}
