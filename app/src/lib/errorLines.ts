import { openingClock } from "./area";

// Story #659 (copy audit A.4 and table L): the server's words never reach a customer's screen. Every refusal becomes one line of ours.
export const NO_INTERNET = "No internet. Check your internet and try again.";
const GENERIC = "Something went wrong. Please try again.";
const BILL = "Something in the bill did not go through. Check it and try again.";
const NOT_PLACED = "Something went wrong. Your order was not placed and nothing was charged. Please try again.";   // story 1580: only for a fault we cannot name
const TRY_LATER = "We could not place your order. Nothing was charged. Try again in a minute.";
export const SIGN_IN_LINE = "Your sign-in ended. Sign in again to place your order.";
export const PRICE_CHANGED_LINE = "The price changed. Check the new total, then tap Place order.";   // with a quote the Bill shows the new total; without one the line still tells the way
// story 1580: every refusal the orders function and place_order_v2 can answer, each with its way out
const PLACE_LINES: Record<string, string> = {
  not_served: "We do not deliver to this place yet. Choose another address.",
  point_required: "Set your place on the map, then place the order.",
  invalid_address: "Add a delivery address.",
  empty_order: "Your bag is empty. Add a dish, then place the order.",
  sold_out: BILL, dish_sold_out: BILL, unknown_dish: BILL, invalid_quantity: BILL, unknown_option: BILL, option_group_max: BILL, option_group_min: BILL, option_unavailable: BILL, invalid_request: BILL,
  coupon_invalid: "That code is not valid. Remove it or pick another.",
  price_changed: PRICE_CHANGED_LINE,
  unauthorized: SIGN_IN_LINE,
  order_unavailable: TRY_LATER, quote_unavailable: TRY_LATER, internal_error: TRY_LATER,
};
const DELIVERED = "Could not mark it delivered. Try again in a minute.";

export type CustomerAction = "place" | "confirm" | "feedback";

// null = not an error: "Already done." on the customer's Yes means the order is already delivered.
export function customerLine(action: CustomerAction, code: string, message: string, opensAt?: string | null, status?: number): string | null {
  if (action === "confirm" && code === "already_done") return null;
  if (code === "kill_switch") return "Orders are paused. Please try again soon.";
  if (code === "kitchen_closed") return opensAt ? `The kitchen closed just now. It opens at ${openingClock(opensAt)}.` : "The kitchen closed just now. Check back later.";
  if (code === "zone_closed") return "We are very busy right now. Please try again in a few minutes.";
  if (code === "instructions_too_long") return "Keep the note to 200 characters.";   // story #935
  if (code === "session_order_cap") return "That is the most orders one phone can place today.";
  if (action === "place") return PLACE_LINES[code] ?? (status === 401 ? SIGN_IN_LINE : status !== undefined && status >= 500 ? TRY_LATER : message === "The order is not valid." || message === "The order is missing something." ? BILL : NOT_PLACED);
  if (action === "feedback") return "Could not send the note. Try again.";
  if (code === "sold_out" || code === "dish_sold_out") return BILL;   // story #619: a dish went sold out; the Bill says which and offers the way out
  if (message === "The order is not valid." || message === "The order is missing something.") return BILL;
  if (action === "confirm" && message !== "Only the customer can confirm.") return DELIVERED;
  return GENERIC;
}

// Story #904: the line matches the error. The cooking line only when the database says cannot_cancel; anything else (a dead network, an expired session) is the connection line.
// Story #1227: the line is true for the customer. cannot_cancel carries the status the order is in now (another phone may have cancelled it first).
export const cancelLine = (message?: string): string => {
  if (!message?.startsWith("cannot_cancel")) return "Could not reach GoServe. Check your connection and try again.";
  const now = message.split(":")[1]?.trim();
  if (now === "cancelled") return "This order is already cancelled.";
  if (now === "delivered") return "This order was already delivered.";
  return "The kitchen has started cooking, so this order cannot be cancelled now. Call the kitchen if you need to.";
};
