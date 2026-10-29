import { openingClock } from "./area";

// Story #659 (copy audit A.4 and table L): the server's words never reach a customer's screen. Every refusal becomes one line of ours.
export const NO_INTERNET = "No internet. Check your internet and try again.";
const GENERIC = "Something went wrong. Please try again.";
const BILL = "Something in the bill did not go through. Check it and try again.";
const DELIVERED = "Could not mark it delivered. Try again in a minute.";

export type CustomerAction = "place" | "confirm" | "feedback";

// null = not an error: "Already done." on the customer's Yes means the order is already delivered.
export function customerLine(action: CustomerAction, code: string, message: string, opensAt?: string | null): string | null {
  if (action === "confirm" && code === "already_done") return null;
  if (code === "kill_switch") return "Orders are paused. Please try again soon.";
  if (code === "kitchen_closed") return opensAt ? `The kitchen closed just now. It opens at ${openingClock(opensAt)}.` : "The kitchen closed just now. Check back later.";
  if (code === "zone_closed") return "We are very busy right now. Please try again in a few minutes.";
  if (code === "session_order_cap") return "That is the most orders one phone can place today.";
  if (action === "feedback") return "Could not send the note. Try again.";
  if (message === "The order is not valid." || message === "The order is missing something.") return BILL;
  if (action === "confirm" && message !== "Only the customer can confirm.") return DELIVERED;
  return GENERIC;
}
