// Story #349: the order-actions handler wired to a fixed database answer, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  act: async (_token, orderId, action, reason) => {
    if (action === "deliver") return { ok: false, error: "illegal_step", message: "The order is not at the step before this one." };
    if (action === "cancel" && !reason) return { ok: false, error: "reason_required", message: "Say why you are cancelling." };
    return { ok: true, order: { id: orderId, kitchen_id: "7e57ab1e-0000-4000-8000-000000000001", status: "accepted", total_paise: 28000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: "2026-10-27T10:00:00Z" } };
  },
});
