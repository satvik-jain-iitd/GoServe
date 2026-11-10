import { customerLine, NO_INTERNET, type CustomerAction } from "./errorLines";
import type { Decision, Rider } from "./ops";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient } from "./supabase";

// The n8n webhook is now used only for the rider decision and the tester feedback (story #940 moved placing and every order step to Supabase).
export class PlaceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type OrderBill = { early_friend_paise?: number; discount_paise?: number };   // story #1295: what the server took off, so the slip lines add up to the total
export type PlacedOrder = { id: string; status: string; total_paise: number; updated_at: string; paid_by?: string | null; bill?: OrderBill | null };
export type OrderDeps = { url: string; token: string; fetchFn: typeof fetch };
export const orderDeps = (): OrderDeps => ({ url: import.meta.env.VITE_ORDER_URL, token: import.meta.env.VITE_DEMO_TOKEN, fetchFn: fetch.bind(window) });

type ApiAnswer = { ok?: boolean; created?: boolean; order?: PlacedOrder; decision?: Decision; id?: string; already_done?: boolean; confirm_after_ready_min?: number; confirm_after_place_min?: number; error?: string; message?: string; opens_at?: string };

// One call to the webhook. `need` names the part of the answer the caller must get; anything else becomes a plain message.
async function callApi(body: object, deps: OrderDeps, need: "order" | "decision" | "id" = "order"): Promise<ApiAnswer> {
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", "x-gs-token": deps.token }, body: JSON.stringify(body) });
  } catch {
    throw new PlaceError(NO_INTERNET, "network");
  }
  let answer: ApiAnswer | null = null;
  try {
    answer = await res.json();
  } catch {
    answer = null;
  }
  if (res.ok && answer?.ok && answer[need]) return answer;
  // The customer's calls (place, confirm, feedback) show our line for every refusal (story #659). The staff calls keep the server's line.
  const kind = (body as { action?: string }).action;
  const mine = kind === "place" || kind === "confirm" || kind === "feedback" ? (kind as CustomerAction) : null;
  const refused = answer && answer.ok === false && typeof answer.message === "string";
  if (mine) {
    const code = refused ? answer!.error ?? "unknown" : "unknown";
    const line = customerLine(mine, code, refused ? answer!.message! : "", answer?.opens_at);
    throw new PlaceError(line ?? "Already done.", code);
  }
  if (refused) throw new PlaceError(answer!.message!, answer!.error ?? "unknown");
  throw new PlaceError("Something went wrong. Please try again.", "unknown");
}

// Story #940: every step after "placed" goes to POST /order-actions with the signed-in user's own token. The database reads who is asking
// (auth.uid()) and decides who may do what. The phone sends the order and the step, never who it is or which session it belongs to.
export type ActDeps = { fetchFn: typeof fetch; token: () => Promise<string>; url: string; anon: string };
export const actDeps = (): ActDeps => ({
  fetchFn: fetch.bind(window), url: import.meta.env.VITE_SUPABASE_URL, anon: import.meta.env.VITE_SUPABASE_ANON_KEY,
  token: async () => (await getClient().auth.getSession()).data.session?.access_token ?? "",
});

// The staff screens keep the server's line; the customer's Yes shows our own line for every refusal (story #659).
async function act(orderId: string, action: string, deps: ActDeps, mine: CustomerAction | null = null, reason?: string, method?: string): Promise<{ order: PlacedOrder; alreadyDone: boolean }> {
  let res: Response;
  try {
    res = await deps.fetchFn(`${deps.url}/functions/v1/order-actions`, {
      method: "POST", headers: { "content-type": "application/json", apikey: deps.anon, authorization: `Bearer ${await deps.token()}` }, body: JSON.stringify({ order_id: orderId, action, ...(reason === undefined ? {} : { reason }), ...(method === undefined ? {} : { method }) }),
    });
  } catch {
    throw new PlaceError(NO_INTERNET, "network");
  }
  const a = await res.json().catch(() => null) as { ok?: boolean; order?: PlacedOrder; error?: string; message?: string } | null;
  if (res.ok && a?.ok && a.order) return { order: a.order, alreadyDone: false };
  const code = typeof a?.error === "string" ? a.error : "unknown";
  if (mine) throw new PlaceError(customerLine(mine, code, typeof a?.message === "string" ? a.message : "") ?? "Already done.", code);
  if (a && a.ok === false && typeof a.message === "string") throw new PlaceError(a.message, code);
  throw new PlaceError("Something went wrong. Please try again.", "unknown");
}

// The customer's Yes: the order closes as delivered and paid by cash. A second Yes is not an error (alreadyDone).
export async function confirmDelivery(input: { orderId: string }, deps: ActDeps): Promise<{ order: PlacedOrder | null; alreadyDone: boolean }> {
  try {
    return await act(input.orderId, "confirm", deps, "confirm");
  } catch (e) {
    if (e instanceof PlaceError && e.code === "already_done") return { order: null, alreadyDone: true };   // an earlier Yes went through: the order is delivered, no line
    throw e;
  }
}

const STEP: Record<string, string> = { accepted: "accept", preparing: "prepare", ready: "ready", out_for_delivery: "pickup", delivered: "deliver" };
export type StatusInput = { orderId: string; to: string; method?: string };   // method: only for delivered, how the customer paid at the door (story 1262)
export async function changeStatus(input: StatusInput, deps: ActDeps): Promise<{ order: PlacedOrder }> {
  const action = STEP[input.to];
  if (!action) throw new PlaceError("Something went wrong. Please try again.", "unknown");
  return { order: (await act(input.orderId, action, deps, null, undefined, input.method)).order };
}

// Story #934: the kitchen declines a new order with a reason the customer reads. The database allows it only for the kitchen or admin, while placed or accepted.
export const MIN_REASON = 20;
export async function declineOrder(input: { orderId: string; reason: string }, deps: ActDeps): Promise<{ order: PlacedOrder }> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) throw new PlaceError(`Write at least ${MIN_REASON} characters so the customer understands.`, "reason_short");
  return { order: (await act(input.orderId, "cancel", deps, null, reason)).order };
}

export type EventInput = { orderId: string; event: "order.arriving" };
export async function addEvent(input: EventInput, deps: ActDeps): Promise<{ order: PlacedOrder }> {
  return { order: (await act(input.orderId, "arriving", deps)).order };
}

// Ask for the rider decision of a ready order (story #46 call, story #51 screen; story #1068: the database decides, n8n is out of it). The rule decides.
// The reply is an answer, not an error: {ok:false, error, message} is a refusal and becomes a plain message.
export async function askDecision(input: { sessionId: string; kitchenId: string; orderId: string; riders: Rider[] }, client: Pick<SupabaseClient, "rpc"> = getClient()): Promise<Decision> {
  const { data, error } = await client.rpc("decide_rider_rules_v2", { p_session: input.sessionId, p_kitchen: input.kitchenId, p_order: input.orderId, p_riders: input.riders });
  if (error || !data) throw new PlaceError(NO_INTERNET_OR_SERVER, "unknown");
  if (data.ok === true && data.decision) return data.decision as Decision;
  throw new PlaceError(typeof data.message === "string" && data.message ? data.message : NO_INTERNET_OR_SERVER, typeof data.error === "string" ? data.error : "unknown");
}
const NO_INTERNET_OR_SERVER = "Something went wrong. Please try again.";

// A tester's report from the Feedback button (story S-B). The server saves it and answers with the new id.
export async function sendFeedback(report: object, deps: OrderDeps): Promise<string> {
  const a = await callApi(report, deps, "id");
  return a.id as string;
}
