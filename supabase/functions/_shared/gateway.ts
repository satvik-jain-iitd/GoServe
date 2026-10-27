// Story #348: the payment gateway as an injected dependency. TEST DOUBLE: FakeGateway makes up ids and records every call; it moves no money.
// The real adapter is `razorpay.ts` (empty but named). When the owner's Razorpay KYC is done: fill that file, set PAYMENTS_PROVIDER=razorpay and the keys.
export type Gateway = {
  provider: string;
  createOrder: (amount_paise: number, receipt: string) => Promise<{ provider_order_id: string; amount_paise: number; currency: string }>;
  refund: (provider_payment_id: string, amount_paise: number) => Promise<{ refund_id: string }>;
};
type Call = { kind: "create"; amount_paise: number; receipt: string } | { kind: "refund"; provider_payment_id: string; amount_paise: number };

export class FakeGateway implements Gateway {
  provider = "fake";
  calls: Call[] = [];
  createOrder(amount_paise: number, receipt: string) {
    this.calls.push({ kind: "create", amount_paise, receipt });
    return Promise.resolve({ provider_order_id: `fake_order_${crypto.randomUUID().slice(0, 8)}`, amount_paise, currency: "INR" });
  }
  refund(provider_payment_id: string, amount_paise: number) {
    this.calls.push({ kind: "refund", provider_payment_id, amount_paise });
    return Promise.resolve({ refund_id: `fake_refund_${crypto.randomUUID().slice(0, 8)}` });
  }
}

// PLACEHOLDER (owner click): Razorpay — swap `razorpay.ts`, set PAYMENTS_PROVIDER=razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
export const gatewayFromEnv = async (): Promise<Gateway> => {
  if (Deno.env.get("PAYMENTS_PROVIDER") === "razorpay") {
    const { razorpay } = await import("./razorpay.ts");
    return razorpay();
  }
  return new FakeGateway();
};
