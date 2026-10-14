// Placing an order: one call to the n8n webhook with the demo token (ADR-009, docs/integrations/n8n-order-workflows.md).
// The phone sends ids and quantities; the server prices the order. Server text is shown only in the expected shape.
export class PlaceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type PlaceInput = { sessionId: string; key: string; items: { menu_item_id: string; qty: number }[]; address: string };
export type PlacedOrder = { id: string; status: string; total_paise: number };
export type OrderDeps = { url: string; token: string; fetchFn: typeof fetch };

export async function placeOrder(input: PlaceInput, deps: OrderDeps): Promise<{ order: PlacedOrder; created: boolean }> {
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gs-token": deps.token },
      body: JSON.stringify({ action: "place", session_id: input.sessionId, client_order_key: input.key, items: input.items, address: input.address }),
    });
  } catch {
    throw new PlaceError("No network. Check your connection and try again.", "network");
  }
  let body: { ok?: boolean; created?: boolean; order?: PlacedOrder; error?: string; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok && body?.ok && body.order) return { order: body.order, created: body.created === true };
  if (body && body.ok === false && typeof body.message === "string") throw new PlaceError(body.message, body.error ?? "unknown");
  throw new PlaceError("Something went wrong. Please try again.", "unknown");
}
