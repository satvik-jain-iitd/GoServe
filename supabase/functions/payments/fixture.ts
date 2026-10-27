// Story #348: the payments handler wired to the FakeGateway and fixed answers, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";
import { FakeGateway } from "../_shared/gateway.ts";

export const CONTRACT_SECRET = "contract-secret";
export const handler = makeHandler({
  session: async (req) => (req.headers.get("authorization") ? "7e57ab1e-0000-4000-8000-0000000000a1" : null),
  gateway: new FakeGateway(),
  prepare: async (order) => (order.endsWith("dead") ? { ok: false, error: "order_not_found", message: "This order was not found." } : { ok: true, amount_paise: 28000, existing: null }),
  store: async () => ({ ok: true }),
  markPaid: async (_p, orderId) => (orderId === "unknown" ? { ok: false, error: "payment_not_found", message: "No such payment." } : { ok: true, order_id: "7e57ab1e-0000-4000-8000-0000000000f1" }),
  switchCash: async (order) => (order.endsWith("dead") ? { ok: false, error: "order_not_found", message: "This order was not found." } : order.endsWith("f9") ? { ok: false, error: "already_paid", message: "This order is already paid." } : { ok: true }),
  secret: () => CONTRACT_SECRET,
});
