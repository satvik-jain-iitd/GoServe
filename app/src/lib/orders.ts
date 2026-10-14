import type { Decision, Rider } from "./ops";

// Placing an order: one call to the n8n webhook with the demo token (ADR-009, docs/integrations/n8n-order-workflows.md).
// The phone sends ids and quantities; the server prices the order. Server text is shown only in the expected shape.
export class PlaceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type PlaceInput = { sessionId: string; key: string; items: { menu_item_id: string; qty: number }[]; address: string };
export type PlacedOrder = { id: string; status: string; total_paise: number; updated_at: string };
export type OrderDeps = { url: string; token: string; fetchFn: typeof fetch };
export const orderDeps = (): OrderDeps => ({ url: import.meta.env.VITE_ORDER_URL, token: import.meta.env.VITE_DEMO_TOKEN, fetchFn: fetch.bind(window) });

type ApiAnswer = { ok?: boolean; created?: boolean; order?: PlacedOrder; decision?: Decision; error?: string; message?: string };

// One call to the webhook. `need` names the part of the answer the caller must get; anything else becomes a plain message.
async function callApi(body: object, deps: OrderDeps, need: "order" | "decision" = "order"): Promise<ApiAnswer> {
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", "x-gs-token": deps.token }, body: JSON.stringify(body) });
  } catch {
    throw new PlaceError("No network. Check your connection and try again.", "network");
  }
  let answer: ApiAnswer | null = null;
  try {
    answer = await res.json();
  } catch {
    answer = null;
  }
  if (res.ok && answer?.ok && answer[need]) return answer;
  if (answer && answer.ok === false && typeof answer.message === "string") throw new PlaceError(answer.message, answer.error ?? "unknown");
  throw new PlaceError("Something went wrong. Please try again.", "unknown");
}

export async function placeOrder(input: PlaceInput, deps: OrderDeps): Promise<{ order: PlacedOrder; created: boolean }> {
  const a = await callApi({ action: "place", session_id: input.sessionId, client_order_key: input.key, items: input.items, address: input.address }, deps);
  return { order: a.order as PlacedOrder, created: a.created === true };
}

export type StatusInput = { sessionId: string; orderId: string; to: string; actor: "customer" | "kitchen" | "rider" | "ops" };
export async function changeStatus(input: StatusInput, deps: OrderDeps): Promise<{ order: PlacedOrder }> {
  const a = await callApi({ action: "status", session_id: input.sessionId, order_id: input.orderId, to_status: input.to, actor: input.actor }, deps);
  return { order: a.order as PlacedOrder };
}

export type EventInput = { sessionId: string; orderId: string; event: "order.arriving"; actor: "customer" | "kitchen" | "rider" | "ops" };
export async function addEvent(input: EventInput, deps: OrderDeps): Promise<{ order: PlacedOrder }> {
  const a = await callApi({ action: "event", session_id: input.sessionId, order_id: input.orderId, event: input.event, actor: input.actor }, deps);
  return { order: a.order as PlacedOrder };
}

// Ask for the rider decision of a ready order (story #46 call, story #51 screen). The rule decides; the answer also carries the AI's advice.
export async function askDecision(input: { sessionId: string; orderId: string; riders: Rider[] }, deps: OrderDeps): Promise<Decision> {
  const a = await callApi({ action: "decide", session_id: input.sessionId, order_id: input.orderId, riders: input.riders }, deps, "decision");
  return a.decision as Decision;
}
