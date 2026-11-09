// Story A2 (#149): the admin screen's input rules.
import { describe, expect, it } from "vitest";
import { parsePins, removeKitchen } from "../../src/lib/admin";

describe("parsePins", () => {
  it("reads pin codes separated by commas or spaces and drops repeats", () => {
    expect(parsePins("110016, 110017 110016")).toEqual({ pins: ["110016", "110017"], bad: [] });
  });
  it("names every entry that is not six digits", () => {
    expect(parsePins("1100, abc, 110016")).toEqual({ pins: ["110016"], bad: ["1100", "abc"] });
  });
  it("an empty field is no pin codes", () => {
    expect(parsePins("  ")).toEqual({ pins: [], bad: [] });
  });
});

import { photoPath, photoProblem, rupeesToPaise } from "../../src/lib/admin";

describe("rupeesToPaise (story A3)", () => {
  it("turns rupees into paise", () => {
    expect(rupeesToPaise("320")).toBe(32000);
    expect(rupeesToPaise("60.50")).toBe(6050);
    expect(rupeesToPaise(" 8 ")).toBe(800);
  });
  it("refuses empty, negative, zero, text and more than two decimals", () => {
    for (const bad of ["", "-5", "0", "abc", "1.234", "1,5"]) expect(rupeesToPaise(bad), bad).toBeNull();
  });
});

describe("photoProblem", () => {
  it("accepts a picture up to 3 MB", () => {
    expect(photoProblem({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
  });
  it("refuses a file that is not a picture, or is too big", () => {
    expect(photoProblem({ type: "application/pdf", size: 10 })).toMatch(/picture/);
    expect(photoProblem({ type: "image/png", size: 3 * 1024 * 1024 + 1 })).toMatch(/3 MB/);
  });
});

describe("photoPath", () => {
  it("keeps the photo under its kitchen with a safe name", () => {
    expect(photoPath("k-1", "My Dish (1).JPG", "abc")).toBe("k-1/abc.jpg");
    expect(photoPath("k-1", "noext", "abc")).toBe("k-1/abc.jpg");
  });
});

import { filterAdminOrders, istDayStart, sumNumbers, type AdminOrder, type DayNumbers } from "../../src/lib/admin";

describe("istDayStart (story A4)", () => {
  it("is midnight in India, as a UTC moment", () => {
    expect(istDayStart(new Date("2026-10-23T10:00:00Z"))).toBe("2026-10-22T18:30:00.000Z");
    expect(istDayStart(new Date("2026-10-23T19:00:00Z"))).toBe("2026-10-23T18:30:00.000Z");   // 00:30 on 24 Oct in India
  });
});

const ord = (id: string, kitchen_id: string, status: string): AdminOrder => ({ id, kitchen_id, status, created_at: "2026-10-23T10:00:00Z", total_paise: 100, items: [], address: "a", customer_name: null, customer_phone: null, cancel_reason: null });
describe("filterAdminOrders", () => {
  const list = [ord("a", "k1", "placed"), ord("b", "k2", "delivered"), ord("c", "k1", "cancelled")];
  it("keeps all when no filter is set", () => {
    expect(filterAdminOrders(list, "", "").map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
  it("filters by kitchen and by status", () => {
    expect(filterAdminOrders(list, "k1", "").map((o) => o.id)).toEqual(["a", "c"]);
    expect(filterAdminOrders(list, "", "delivered").map((o) => o.id)).toEqual(["b"]);
    expect(filterAdminOrders(list, "k1", "cancelled").map((o) => o.id)).toEqual(["c"]);
  });
});

describe("sumNumbers", () => {
  const row = (kitchen_name: string, orders: number, delivered: number, cancelled: number, cash_paise: number): DayNumbers => ({ kitchen_id: kitchen_name, kitchen_name, orders, delivered, cancelled, cash_paise });
  it("adds the kitchens into one day total", () => {
    expect(sumNumbers([row("A", 5, 3, 1, 90000), row("B", 2, 2, 0, 40000)])).toEqual({ orders: 7, delivered: 5, cancelled: 1, cash_paise: 130000 });
  });
  it("is all zeros for no kitchens", () => {
    expect(sumNumbers([])).toEqual({ orders: 0, delivered: 0, cancelled: 0, cash_paise: 0 });
  });
});

import { addPerson, adminMessage, cancelInvite, claimInvites, inviteLink, listInvites } from "../../src/lib/admin";

// Story 875: an admin invites a person by email before their first sign-in.
describe("addPerson (story 875)", () => {
  const client = (reply: { data: unknown; error: { message: string; details?: string } | null }) => {
    const calls: { name: string; args: unknown }[] = [];
    return { calls, c: { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return reply; } } as never };
  };
  it("says the person was invited when the database kept an invite", async () => {
    const { c, calls } = client({ data: { invited: true }, error: null });
    expect(await addPerson(c, "  Sunita@Gmail.com ", "kitchen", "k-1")).toEqual({ error: null, invited: true });
    expect(calls[0]).toEqual({ name: "admin_add_person", args: { p_email: "Sunita@Gmail.com", p_kind: "kitchen", p_kitchen: "k-1" } });
  });
  it("says not invited when the person already had an account and joined at once", async () => {
    expect(await addPerson(client({ data: { invited: false }, error: null }).c, "a@b.co", "rider", null)).toEqual({ error: null, invited: false });
  });
  it("turns a refusal into a line and never says invited", async () => {
    const r = await addPerson(client({ data: null, error: { message: "not_allowed" } }).c, "a@b.co", "rider", null);
    expect(r.invited).toBe(false);
    expect(r.error).toBe("Not allowed.");
  });
});

describe("adminMessage for an account that already works for a kitchen (story 875)", () => {
  it("names the kitchen the account already runs", () => {
    expect(adminMessage({ message: "already_staff", details: "Amma Kitchen" })).toBe("This person already works for Amma Kitchen. Remove them there first.");
  });
  it("still reads well when the kitchen name did not come", () => {
    expect(adminMessage({ message: "already_staff" })).toBe("This person already works for another kitchen. Remove them there first.");
  });
  it("an unknown email is no longer a message: only an admin account must exist", () => {
    expect(adminMessage({ message: "no_such_user" })).toMatch(/admin/i);
  });
});

describe("inviteLink (story 875)", () => {
  it("opens the kitchen app for a cook and the rider app for a rider", () => {
    expect(inviteLink("kitchen", "https://goserve-app.pages.dev")).toBe("https://goserve-app.pages.dev/kitchen/");
    expect(inviteLink("rider", "https://goserve-app.pages.dev/")).toBe("https://goserve-app.pages.dev/rider/");
  });
});

describe("invites list, cancel and claim (story 875)", () => {
  it("reads the open invites from the admin function", async () => {
    const rows = [{ id: "i-1", email: "sunita@gmail.com", kind: "kitchen", kitchen_id: "k-1", kitchen_name: "Tau Ka Dhaba", created_at: "2026-11-04T10:00:00Z" }];
    expect(await listInvites({ rpc: async () => ({ data: rows, error: null }) } as never)).toEqual(rows);
  });
  it("cancel sends the invite id and reports a failure as a line", async () => {
    const sent: unknown[] = [];
    const ok = { rpc: async (n: string, a: unknown) => { sent.push([n, a]); return { error: null }; } } as never;
    expect(await cancelInvite(ok, "i-1")).toBeNull();
    expect(sent).toEqual([["admin_cancel_invite", { p_id: "i-1" }]]);
    expect(await cancelInvite({ rpc: async () => ({ error: { message: "boom" } }) } as never, "i-1")).toMatch(/did not work/i);
  });
  it("the gate check returns how many invites it claimed, and 0 on any failure", async () => {
    expect(await claimInvites({ rpc: async () => ({ data: 2, error: null }) } as never)).toBe(2);
    expect(await claimInvites({ rpc: async () => ({ data: null, error: { message: "x" } }) } as never)).toBe(0);
    expect(await claimInvites({ rpc: async () => { throw new Error("offline"); } } as never)).toBe(0);
  });
});

// Story 880: removing a rider.
describe("adminMessage when the network is gone or a rider cannot be removed (story 880)", () => {
  it("says there is no connection, not a bare failure", () => {
    expect(adminMessage({ message: "TypeError: Failed to fetch" })).toBe("No connection. Check the network and try again.");
    expect(adminMessage({ message: "NetworkError when attempting to fetch resource." })).toBe("No connection. Check the network and try again.");
  });
  it("a foreign key refusal says the rider still has orders and what to do", () => {
    expect(adminMessage({ message: 'update or delete on table "riders" violates foreign key constraint "orders_rider_id_fkey" on table "orders"' })).toBe("This rider still has orders on record. Try again after the update, or ask the builder.");
  });
});

// Story #900 (moved from the kitchen app, story #850): the admin removes a kitchen; the data path is one database function.
describe("removeKitchen", () => {
  type Reply = { data: unknown; error: { message: string; code?: string } | null };
  const client = (reply: Reply, calls: unknown[][] = [], open: number | null = 3) => ({
    rpc: async (...a: unknown[]) => { calls.push(a); return reply; },
    from: () => ({ select: () => ({ eq: () => ({ not: async () => (open === null ? { count: null, error: { message: "x" } } : { count: open, error: null }) }) }) }),
  }) as never;
  const CONNECT = "Could not reach GoServe. Check your connection and try again.";
  it("calls kitchen_remove_v2 with the kitchen and says nothing when it worked", async () => {
    const calls: unknown[][] = [];
    expect(await removeKitchen(client({ data: { ok: true, staff: 2 }, error: null }, calls), "k-1")).toBeNull();
    expect(calls).toEqual([["kitchen_remove_v2", { p_kitchen: "k-1" }]]);
  });
  it("S1 open orders: the line says how many, and what to do", async () => {
    const refuse = { data: { ok: false, error: "orders_open", message: "x" }, error: null };
    expect(await removeKitchen(client(refuse, [], 3), "k-1")).toBe("This kitchen has 3 open orders. Finish or cancel them first.");
    expect(await removeKitchen(client(refuse, [], 1), "k-1")).toBe("This kitchen has 1 open order. Finish or cancel them first.");
    expect(await removeKitchen(client(refuse, [], null), "k-1")).toBe("This kitchen has open orders. Finish or cancel them first.");
  });
  it("S2 a non-admin is told so", async () => {
    expect(await removeKitchen(client({ data: null, error: { message: "not_allowed", code: "42501" } }), "k-1")).toBe("Only an admin can remove a kitchen.");
  });
  it("S3 a missing database function or a dead network is not called 'try again': it says GoServe could not be reached", async () => {
    expect(await removeKitchen(client({ data: null, error: { message: "Could not find the function public.kitchen_remove_v2(p_kitchen) in the schema cache", code: "PGRST202" } }), "k-1")).toBe(CONNECT);
    expect(await removeKitchen(client({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } }), "k-1")).toBe(CONNECT);
    expect(await removeKitchen(client({ data: null, error: { message: "fetch failed" } }), "k-1")).toBe(CONNECT);
  });
  it("any other database error keeps the plain retry line", async () => {
    expect(await removeKitchen(client({ data: null, error: { message: "boom", code: "XX000" } }), "k-1")).toBe("Could not remove the kitchen. Try again.");
  });
});

import { fitSize } from "../../src/lib/photo";
describe("fitSize (story #921)", () => {
  it("keeps the ratio and makes the longest side 800", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 800, height: 600 });
    expect(fitSize(3000, 4000)).toEqual({ width: 600, height: 800 });
  });
  it("never makes a small picture bigger", () => {
    expect(fitSize(400, 300)).toEqual({ width: 400, height: 300 });
  });
  it("never goes to zero on a thin strip", () => {
    expect(fitSize(8000, 1).height).toBe(1);
  });
});

// Story #985: the owner is one hardcoded address. The app's constant and the database's constant are the same string.
describe("the owner account (story 985)", () => {
  it("OWNER_EMAIL is the owner_email() of the migration", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { OWNER_EMAIL } = await import("../../src/lib/admin");
    const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/20261108100000_owner_admin.sql"), "utf8");
    expect(sql.match(/select '([^']+)'::text/)?.[1]).toBe(OWNER_EMAIL);
    expect(OWNER_EMAIL).toBe(OWNER_EMAIL.toLowerCase());
  });
  it("isOwner matches the address in any letter case and nothing else", async () => {
    const { isOwner, OWNER_EMAIL } = await import("../../src/lib/admin");
    expect(isOwner({ email: OWNER_EMAIL })).toBe(true);
    expect(isOwner({ email: OWNER_EMAIL.toUpperCase() })).toBe(true);
    expect(isOwner({ email: "someone@example.com" })).toBe(false);
    expect(isOwner({ email: null })).toBe(false);
  });
  it("owner_admin says so in words", async () => {
    const { adminMessage } = await import("../../src/lib/admin");
    expect(adminMessage({ message: "owner_admin" })).toBe("The owner account cannot be removed.");
  });
});
