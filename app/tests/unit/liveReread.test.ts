// Story #967: the customer's tracker (and the kitchen and the rider) read the orders again every 30 s and at once when the live channel breaks, so a missed change always catches up.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rereadEvery, watchOrders } from "../../src/lib/live";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rereadEvery (the safety net)", () => {
  it("S1 reads again every 30 seconds while it runs", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const stop = rereadEvery(reload);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reload).toHaveBeenCalledTimes(2);
    stop();
  });
  it("S2 a read that fails is tried again on the next tick, never swallowed for good", async () => {
    const reload = vi.fn().mockRejectedValueOnce(new Error("401")).mockResolvedValue(undefined);
    const stop = rereadEvery(reload);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledTimes(2);
    stop();
  });
  it("S3 one read in flight at a time: a slow read is not piled on", async () => {
    let finish!: () => void;
    const reload = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    const stop = rereadEvery(reload);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(reload).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reload).toHaveBeenCalledTimes(2);
    stop();
  });
  it("S8 a hidden tab does not read; the wake read catches it up", async () => {
    vi.stubGlobal("document", { visibilityState: "hidden" });
    const reload = vi.fn().mockResolvedValue(undefined);
    const stop = rereadEvery(reload);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(reload).not.toHaveBeenCalled();
    vi.stubGlobal("document", { visibilityState: "visible" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
    vi.unstubAllGlobals();
  });
  it("S4 stop ends the reading", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    rereadEvery(reload)();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("watchOrders when the channel breaks", () => {
  const fake = (status: string) => {
    const channel: any = { on: () => channel, subscribe: (cb: (s: string) => void) => { cb(status); return channel; } };
    return { channel: () => channel, removeChannel: () => Promise.resolve() } as any;
  };
  for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
    it(`S5 ${status} reads again at once`, () => {
      const down = vi.fn();
      watchOrders(fake(status), { column: "session_id", value: "s" } as any, () => {}, undefined, undefined, down);
      expect(down).toHaveBeenCalledTimes(1);
    });
  }
  it("S7 a stop we asked for does not read again (removeChannel reports CLOSED)", () => {
    let cb: (s: string) => void = () => {};
    const channel: any = { on: () => channel, subscribe: (f: (s: string) => void) => { cb = f; return channel; } };
    const client: any = { channel: () => channel, removeChannel: () => { cb("CLOSED"); return Promise.resolve(); } };
    const down = vi.fn();
    const stop = watchOrders(client, { column: "session_id", value: "s" } as any, () => {}, undefined, undefined, down);
    stop();
    expect(down).not.toHaveBeenCalled();
  });
  it("S6 SUBSCRIBED is not a break", () => {
    const down = vi.fn(); const ready = vi.fn();
    watchOrders(fake("SUBSCRIBED"), { column: "session_id", value: "s" } as any, () => {}, ready, undefined, down);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(down).not.toHaveBeenCalled();
  });
});
