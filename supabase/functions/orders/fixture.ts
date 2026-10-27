// Story #347: the orders handler wired to a fixed catalog and a fixed database answer, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";
import { DEFAULT_RULES } from "../quote/quote.ts";

const D1 = "7e57ab1e-0000-4000-8000-0000000000d1", K = "7e57ab1e-0000-4000-8000-000000000001";
export const handler = makeHandler({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Dal Makhani thali", price_paise: 14000, available: true } }, options: {} }),
  rules: async () => DEFAULT_RULES, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async (req) => (req.headers.get("authorization") ? "s1" : null),
  place: async () => ({ ok: true, created: true, order: { id: "7e57ab1e-0000-4000-8000-0000000000f1", kitchen_id: K, status: "placed", total_paise: 28000, address: "Flat 4, Green Park", items: [], bill: { to_pay_paise: 28000 }, created_at: "2026-10-27T10:00:00Z" } }),
});
