// Story #659 (copy audit A.4 and table L): the server's words never reach the customer's screen. Every server code or line maps to one line of ours.
import { describe, expect, it } from "vitest";
import { customerLine, NO_INTERNET } from "../../src/lib/errorLines";

const GENERIC = "Something went wrong. Please try again.";
const DELIVERED = "Could not mark it delivered. Try again in a minute.";
const BILL = "Something in the bill did not go through. Check it and try again.";

describe("customerLine", () => {
  it("says one phrase for no internet", () => {
    expect(NO_INTERNET).toBe("No internet. Check your internet and try again.");
  });
  it.each([
    ["place", "unknown", "Unknown action."],
    ["place", "unknown", "Missing or wrong demo token."],
    ["place", "unknown", "Unknown event."],
    ["place", "unknown", "Unknown status."],
    ["place", "invalid_request", "The event is missing something."],
    ["place", "invalid_request", "Only the customer can confirm."],
    ["confirm", "invalid_request", "Only the customer can confirm."],
    ["place", "database_error", "Anything the server wrote."],
  ] as const)("%s %s %s -> a generic line", (action, code, message) => {
    expect(customerLine(action, code, message)).toBe(GENERIC);
  });
  it("paused keeps its line", () => {
    expect(customerLine("place", "kill_switch", "Orders are paused. Please try again soon.")).toBe("Orders are paused. Please try again soon.");
  });
  it("kitchen closed names the time when there is one, and asks to check back when there is none", () => {
    expect(customerLine("place", "kitchen_closed", "The kitchen is closed right now. Please try again later.", "11:00:00")).toBe("The kitchen closed just now. It opens at 11:00 am.");
    expect(customerLine("place", "kitchen_closed", "The kitchen is closed right now. Please try again later.")).toBe("The kitchen closed just now. Check back later.");
  });
  it("the session cap has its line", () => {
    expect(customerLine("place", "session_order_cap", "Too many orders in this demo session.")).toBe("That is the most orders one phone can place today.");
  });
  it("a dish gone sold out says the bill did not go through (story 619: the Bill then names it)", () => {
    expect(customerLine("place", "sold_out", "Dal is sold out.")).toBe(BILL);
    expect(customerLine("place", "dish_sold_out", "Dal is sold out.")).toBe(BILL);
  });
  it("a bad order says the bill did not go through", () => {
    expect(customerLine("place", "invalid_request", "The order is not valid.")).toBe(BILL);
    expect(customerLine("place", "invalid_request", "The order is missing something.")).toBe(BILL);
  });
  it.each([
    ["order_not_found", "No such order in this session."],
    ["not_ready", "The order is not ready yet."],
    ["rider_unavailable", "That rider is not available."],
    ["illegal_step", "That step is not allowed now."],
    ["invalid_request", "The status change is missing something."],
  ])("Yes, I have it refused (%s) -> could not mark it delivered", (code, message) => {
    expect(customerLine("confirm", code, message)).toBe(DELIVERED);
  });
  it("Already done is a success, not a line", () => {
    expect(customerLine("confirm", "already_done", "Already done.")).toBeNull();
  });
  it("a refused feedback note says so in our words", () => {
    expect(customerLine("feedback", "invalid_request", "The report is not valid.")).toBe("Could not send the note. Try again.");
    expect(customerLine("feedback", "database_error", "Something went wrong. Please try again.")).toBe("Could not send the note. Try again.");
  });
});
