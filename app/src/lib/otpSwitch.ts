// Story 829: the phone code login switch. One row in `settings` (otp_login_on), readable by anyone and in the Realtime publication (migration 20261103100000).
// The app reads it at start and again when it changes. The event only says "something changed", so the caller reads the row again; a missed event is healed
// by a poll and by the tab coming back to the front, the same way liveMenu.ts heals the menu.
import type { SupabaseClient } from "@supabase/supabase-js";

/** true or false when the row says so, null when it is missing, not a boolean, or could not be read. */
export async function readOtpSwitch(c: Pick<SupabaseClient, "from">): Promise<boolean | null> {
  try {
    const { data, error } = await c.from("settings").select("value").eq("name", "otp_login_on").maybeSingle();
    return !error && typeof data?.value === "boolean" ? data.value : null;
  } catch {
    return null;
  }
}

export function watchOtpSwitch(c: Pick<SupabaseClient, "from" | "channel" | "removeChannel">, onChange: (on: boolean | null) => void, { pollMs = 8000 } = {}): () => void {
  let alive = true;
  const read = () => { void readOtpSwitch(c).then((v) => { if (alive) onChange(v); }); };
  const poll = () => { if (typeof document === "undefined" || !document.hidden) read(); };   // a backgrounded phone does not ask every few seconds
  read();
  const channel = c.channel("otp-login-switch").on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "name=eq.otp_login_on" }, read).subscribe();
  const timer = pollMs > 0 ? setInterval(poll, pollMs) : undefined;
  const onVisible = () => { if (typeof document !== "undefined" && document.visibilityState === "visible") read(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  return () => {
    alive = false;
    if (timer) clearInterval(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    void c.removeChannel(channel);
  };
}

// The admin's side (story 829): who flipped it and when, and the flip itself. Both go through functions that check is_admin() in the database.
export type OtpSwitchAdmin = { on: boolean; updated_by: string | null; updated_at: string };

export async function readOtpSwitchAdmin(c: Pick<SupabaseClient, "rpc">): Promise<OtpSwitchAdmin> {
  const { data, error } = await c.rpc("otp_login_get_v2");
  if (error || !data) throw error ?? new Error("no switch");
  return data as OtpSwitchAdmin;
}

/** null when it was saved, else a line to show. */
export async function saveOtpSwitch(c: Pick<SupabaseClient, "rpc">, on: boolean): Promise<string | null> {
  const { data, error } = await c.rpc("otp_login_set_v2", { p_on: on });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
