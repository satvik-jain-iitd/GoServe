// Story 829: the phone code login is a switch (settings row otp_login_on). Order: the phone's own override, then the setting, then VITE_OTP_GATE, then off.
import { describe, expect, it, vi } from "vitest";
import { otpLoginOn } from "../../src/lib/otpGate";
import { readOtpSwitch, watchOtpSwitch } from "../../src/lib/otpSwitch";

const store = (v: string | null) => ({ getItem: () => v });

describe("otpLoginOn", () => {
  it("is off when nothing says otherwise", () => {
    expect(otpLoginOn(null, {}, store(null))).toBe(false);
  });
  it("follows the setting over VITE_OTP_GATE", () => {
    expect(otpLoginOn(true, {}, store(null))).toBe(true);
    expect(otpLoginOn(false, { VITE_OTP_GATE: "1" }, store(null))).toBe(false);
  });
  it("falls back to VITE_OTP_GATE when the setting could not be read, and to off after that", () => {
    expect(otpLoginOn(null, { VITE_OTP_GATE: "1" }, store(null))).toBe(true);
    expect(otpLoginOn(null, {}, store(null))).toBe(false);
  });
  // Story #1106 (TC 1.13): offline the read fails; the screen must be the one the phone showed the last time it could read, not the build value.
  it("uses the last setting the phone read when the read fails, before the build value", () => {
    const last = (v: string) => ({ getItem: (k: string) => (k === "gs-otp-last" ? v : null) });
    expect(otpLoginOn(null, { VITE_OTP_GATE: "1" }, last("0"))).toBe(false);
    expect(otpLoginOn(null, {}, last("1"))).toBe(true);
    expect(otpLoginOn(true, {}, last("0"))).toBe(true);   // a fresh read still wins
  });
  it("uses the build value only when the phone never read the setting", () => {
    expect(otpLoginOn(null, { VITE_OTP_GATE: "1" }, store(null))).toBe(true);
  });
  it("keeps the phone's own override (gs-otp-gate=1) for tests and a dev phone", () => {
    expect(otpLoginOn(false, {}, store("1"))).toBe(true);
  });
  it("treats blocked storage as no override", () => {
    expect(otpLoginOn(false, {}, { getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});

const client = (answer: { data: unknown; error: unknown }) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => answer }) }) }) }) as never;

describe("readOtpSwitch", () => {
  it("reads true and false", async () => {
    expect(await readOtpSwitch(client({ data: { value: true }, error: null }))).toBe(true);
    expect(await readOtpSwitch(client({ data: { value: false }, error: null }))).toBe(false);
  });
  it("is null when the row is missing, is not a boolean, or the read fails", async () => {
    expect(await readOtpSwitch(client({ data: null, error: null }))).toBeNull();
    expect(await readOtpSwitch(client({ data: { value: "yes" }, error: null }))).toBeNull();
    expect(await readOtpSwitch(client({ data: null, error: { message: "offline" } }))).toBeNull();
    expect(await readOtpSwitch(client({ data: null, error: { code: "42501", message: "permission denied for table settings" } }))).toBeNull();   // a refused read is "could not read"
    expect(await readOtpSwitch({ from: () => { throw new Error("no network"); } } as never)).toBeNull();
  });
});

describe("watchOtpSwitch", () => {
  const fakeClient = () => {
    const handlers: Array<() => void> = [];
    const channel = { on: (_e: string, _f: unknown, cb: () => void) => { handlers.push(cb); return channel; }, subscribe: () => channel };
    const removed: unknown[] = [];
    let value: boolean | string = false;
    return {
      c: { channel: () => channel, removeChannel: (ch: unknown) => { removed.push(ch); return Promise.resolve("ok"); }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value }, error: null }) }) }) }) } as never,
      fire: () => handlers.forEach((h) => h()), set: (v: boolean) => { value = v; }, removed,
    };
  };

  it("reads at start, again on a Realtime event, and stops when told to", async () => {
    const f = fakeClient();
    const seen: Array<boolean | null> = [];
    const stop = watchOtpSwitch(f.c, (v) => seen.push(v), { pollMs: 0 });
    await vi.waitFor(() => expect(seen).toEqual([false]));
    f.set(true); f.fire();
    await vi.waitFor(() => expect(seen).toEqual([false, true]));
    stop();
    expect(f.removed).toHaveLength(1);
  });
  it("heals a missed event by polling", async () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const seen: Array<boolean | null> = [];
    const stop = watchOtpSwitch(f.c, (v) => seen.push(v), { pollMs: 8000 });
    await vi.advanceTimersByTimeAsync(0);
    f.set(true);
    await vi.advanceTimersByTimeAsync(8000);
    expect(seen.at(-1)).toBe(true);
    stop();
    vi.useRealTimers();
  });
});
