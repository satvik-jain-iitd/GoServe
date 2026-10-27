// PLACEHOLDER (owner click): Razorpay — this file is empty on purpose (story #348). It is the one file to fill once the owner's Razorpay KYC is done.
// It must export `razorpay(): Gateway` (see gateway.ts) using RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then set PAYMENTS_PROVIDER=razorpay.
import type { Gateway } from "./gateway.ts";

export const razorpay = (): Gateway => {
  throw new Error("razorpay adapter not built yet: owner click pending");
};
