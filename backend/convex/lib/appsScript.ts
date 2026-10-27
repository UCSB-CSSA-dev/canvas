/** Response of the Apps Script relay (google-apps-script/Code.gs); extra fields depend on the action. */
export type RelayResponse = { ok: boolean; code?: string; error?: string; [key: string]: unknown };

export function appsScriptConfigured() {
  return Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SHARED_SECRET);
}

/** Posts `{ action, secret, ...payload }` to the Apps Script web app. Never throws. */
export async function callAppsScript(action: string, payload: Record<string, unknown>): Promise<RelayResponse> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!url || !secret) return { ok: false, code: "NOT_CONFIGURED", error: "not configured" };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action, secret }),
    });
    const raw = await response.text();
    try {
      return JSON.parse(raw) as RelayResponse;
    } catch {
      return { ok: false, code: "SEND_FAILED", error: `HTTP ${response.status}: not JSON` };
    }
  } catch (error) {
    return { ok: false, code: "SEND_FAILED", error: String(error) };
  }
}
