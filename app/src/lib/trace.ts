// Story #484: one line in order_trace for what the app did (opened, asked, answered, subscribed). Fire and forget: it never throws and nothing waits for it.
// The database fixes the actor to "app" and refuses another person's order. No keys, tokens or phone numbers go in.
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> };

export async function trace(c: Rpc, orderId: string | null, event: string, result?: string, text?: string): Promise<void> {
  try {
    await c.rpc("trace_app", { p_order: orderId, p_event: event, p_result: result ?? null, p_text: text ?? null });
  } catch {
    /* a lost log line must never break the app */
  }
}
