// Story S-B (#94): what the Feedback button builds and sends. The phone's own screenshot is the picture (no screenshot library).
import { describe, expect, it } from "vitest";
import { buildPayload, DOING, fitSize, flushQueue, IMAGE_MAX_BYTES, IMAGE_MAX_PX, queueReport, shrinkToLimit, type Report } from "../../src/lib/feedback";
import { PlaceError, sendFeedback } from "../../src/lib/orders";

const base = {
  text: "Accept button did nothing", doing: "cooking" as const, role: "kitchen", screen: "/kitchen/", session: "s1",
  order: { id: "o1", status: "placed" }, build: "abc1234", phone: "Pixel 7", online: true, now: new Date("2026-10-15T15:00:00Z"),
  trail: [{ at: "2026-10-15T14:59:58Z", line: "tap Accept" }],
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
};

describe("buildPayload", () => {
  it("S1 carries the words, the screen, the order and the trail, and no secret", () => {
    const p = buildPayload({ ...base, image: "QUJD" });
    expect(p).toMatchObject({ action: "feedback", session_id: "s1", role: "kitchen", screen: "/kitchen/", order_id: "o1", doing: "cooking", text: "Accept button did nothing", image_b64: "QUJD" });
    expect(p.context).toEqual({ order_status: "placed", build: "abc1234", phone: "Pixel 7", online: true, at: "2026-10-15T15:00:00.000Z", trail: base.trail });
    expect(JSON.stringify(p)).not.toMatch(/token|apikey|password/i);
  });
  it("S2 leaves the picture out when there is none", () => {
    expect("image_b64" in buildPayload(base)).toBe(false);
  });
  it("refuses an empty report and cuts the text at 300 characters", () => {
    expect(() => buildPayload({ ...base, text: "   " })).toThrow(/what happened/i);
    expect(buildPayload({ ...base, text: "a".repeat(400) }).text).toHaveLength(300);
  });
  it("knows the six things a tester can be doing", () => {
    expect(DOING).toEqual(["ordering", "cooking", "delivering", "watching ops", "installing", "other"]);
  });
});

describe("picture size (S4)", () => {
  it("fits the long side to 1280 px and never enlarges", () => {
    expect(IMAGE_MAX_PX).toBe(1280);
    expect(fitSize(4000, 2000)).toEqual({ width: 1280, height: 640 });
    expect(fitSize(1000, 3000)).toEqual({ width: 427, height: 1280 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("lowers the quality until the picture is at most 1.5 MB", async () => {
    expect(IMAGE_MAX_BYTES).toBe(1.5 * 1024 * 1024);
    const sizes: Record<string, number> = { "0.8": 4_000_000, "0.65": 2_000_000, "0.5": 1_400_000 };
    const tried: number[] = [];
    const out = await shrinkToLimit(async (q) => { tried.push(q); return new Blob([new Uint8Array(sizes[String(q)] ?? 100)]); });
    expect(tried).toEqual([0.8, 0.65, 0.5]);
    expect(out.size).toBe(1_400_000);
  });
  it("gives up with a clear message when even the lowest quality is too big", async () => {
    await expect(shrinkToLimit(async () => new Blob([new Uint8Array(5_000_000)]))).rejects.toThrow(/too big/i);
  });
});

describe("offline queue (S3)", () => {
  const report = (n: number): Report => ({ action: "feedback", session_id: "s1", role: "kitchen", screen: "/", order_id: "", doing: "other", text: "r" + n, context: {} });
  it("keeps reports in order and sends them when online, stopping at the first failure", async () => {
    const store = memory();
    queueReport(store, report(1));
    queueReport(store, report(2));
    queueReport(store, report(3));
    const sent: string[] = [];
    const left = await flushQueue(store, async (r) => { if (r.text === "r2") throw new PlaceError("No network.", "network"); sent.push(r.text); });
    expect(sent).toEqual(["r1"]);
    expect(left).toBe(2);
    expect(await flushQueue(store, async (r) => void sent.push(r.text))).toBe(0);
    expect(sent).toEqual(["r1", "r2", "r3"]);
  });
  it("drops the picture, not the words, when the phone has no room", () => {
    const store = { ...memory(), setItem: (_k: string, v: string) => { if (v.includes("BIG")) throw new Error("quota"); } } as unknown as Storage;
    expect(queueReport(store, { ...report(1), image_b64: "BIG" })).toBe(true);
  });
});

describe("sendFeedback", () => {
  const deps = (res: () => Promise<Response>, seen: { init?: RequestInit } = {}) => ({
    url: "https://n8n.test/webhook/gs-order", token: "demo-token", fetchFn: (async (_u: string, init: RequestInit) => { seen.init = init; return res(); }) as typeof fetch,
  });
  it("posts the report with the token and returns the new id", async () => {
    const seen: { init?: RequestInit } = {};
    const id = await sendFeedback({ action: "feedback", session_id: "s1", role: "kitchen", screen: "/", order_id: "", doing: "other", text: "hi", context: {} }, deps(async () => new Response(JSON.stringify({ ok: true, id: "f1" }), { status: 201 }), seen));
    expect(id).toBe("f1");
    expect((seen.init?.headers as Record<string, string>)["x-gs-token"]).toBe("demo-token");
  });
  it("turns a refusal into a PlaceError and a dead network into code network", async () => {
    await expect(sendFeedback({} as Report, deps(async () => new Response(JSON.stringify({ ok: false, error: "invalid_request", message: "The report is not valid." }), { status: 400 })))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(sendFeedback({} as Report, deps(async () => { throw new TypeError("x"); }))).rejects.toMatchObject({ code: "network" });
  });
});
