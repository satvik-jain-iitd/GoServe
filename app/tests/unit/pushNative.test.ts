// Story #554: the native push seam. The row and the web push are tested in tests/e2e/alerts.spec.ts.
import { describe, expect, it } from "vitest";
import { placeholderLeft, wrapperToken } from "../../src/lib/pushNative";

describe("the native push seam", () => {
  it("a browser has no wrapper, so there is no token", async () => {
    expect(await wrapperToken({})).toBeNull();
  });
  it("a wrapper hands over its platform and token", async () => {
    expect(await wrapperToken({ GoServeNative: { platform: "ios", pushToken: async () => "tok-i" } })).toEqual({ platform: "ios", token: "tok-i" });
  });
  it("a wrapper with a platform we do not send to, or an empty token, gives nothing", async () => {
    expect(await wrapperToken({ GoServeNative: { platform: "web", pushToken: async () => "t" } })).toBeNull();
    expect(await wrapperToken({ GoServeNative: { platform: "android", pushToken: async () => "" } })).toBeNull();
    expect(await wrapperToken({ GoServeNative: { platform: "android", pushToken: async () => { throw new Error("denied"); } } })).toBeNull();
  });
  it("seam: switched on while the bridge is the placeholder is wrong", () => {
    expect(placeholderLeft({ VITE_PUSH_NATIVE: "real" })).toBe(true);
    expect(placeholderLeft({})).toBe(false);
  });
  it("seam: the env this run was started with must not hold the placeholder with the native push on", () => {
    expect(placeholderLeft(import.meta.env), "VITE_PUSH_NATIVE=real needs the wrapper bridge in src/lib/pushNative.ts (owner click: FCM and Apple)").toBe(false);
  });
});
