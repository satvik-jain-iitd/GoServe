// Story #552: the payment seam and the dev helper. The screens are tested in tests/e2e/pay.spec.ts.
import { describe, expect, it } from "vitest";
import { devHelperOn, openGateway, placeholderLeft, signWebhook } from "../../src/lib/payGateway";
import { PAY_METHODS, PAY_WINDOW_S } from "../../src/lib/payments";

describe("the payment seam", () => {
  it("the placeholder sheet opens nothing and says so", async () => {
    expect(await openGateway({ provider: "fake", provider_order_id: "o1", amount_paise: 100 }, {})).toBe("placeholder");
  });
  it("with the provider switched on, an unbuilt sheet is an error, not a silent wait", async () => {
    expect(placeholderLeft({ VITE_PAYMENTS_PROVIDER: "razorpay" })).toBe(true);
    await expect(openGateway({ provider: "razorpay", provider_order_id: "o1", amount_paise: 100 }, { VITE_PAYMENTS_PROVIDER: "razorpay" })).rejects.toThrow("owner click pending");
  });
  it("seam: the env this run was started with must not hold the placeholder with the provider on", () => {
    expect(placeholderLeft(import.meta.env), "VITE_PAYMENTS_PROVIDER=razorpay needs the sheet in src/lib/payGateway.ts (owner click)").toBe(false);
  });
});

describe("the dev helper", () => {
  it("is absent unless VITE_PAYMENTS_PLACEHOLDER=1 and a dev secret is set", () => {
    expect(devHelperOn({})).toBe(false);
    expect(devHelperOn({ VITE_PAYMENTS_PLACEHOLDER: "1" })).toBe(false);
    expect(devHelperOn({ VITE_PAYMENTS_DEV_SECRET: "s" })).toBe(false);
    expect(devHelperOn({ VITE_PAYMENTS_PLACEHOLDER: "0", VITE_PAYMENTS_DEV_SECRET: "s" })).toBe(false);
    expect(devHelperOn({ VITE_PAYMENTS_PLACEHOLDER: "1", VITE_PAYMENTS_DEV_SECRET: "s" })).toBe(true);
  });
  it("signs the way the webhook checks: hex HMAC-SHA256 over provider_order_id|provider_payment_id", async () => {
    const sig = await signWebhook("secret", "order_1", "pay_1");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(sig).toBe("52115a0d3400de9e86aade1f1b6eba9e8974604f4e267a9e9a16633a4c8dd2cb");   // the same value node's crypto gives
    expect(await signWebhook("secret", "order_1", "pay_2")).not.toBe(sig);
  });
});

describe("the choices", () => {
  it("are cash first, then UPI, then Card, and the window matches the database expiry of 15 minutes", () => {
    expect(PAY_METHODS.map((m) => m.id)).toEqual(["cod", "upi", "card"]);
    expect(PAY_WINDOW_S).toBe(900);
  });
});
