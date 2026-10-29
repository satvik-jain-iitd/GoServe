// Story #345: the quote handler wired to a fixed catalog, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";
import { DEFAULT_RULES } from "./quote.ts";

const D1 = "7e57ab1e-0000-4000-8000-0000000000d1", D2 = "7e57ab1e-0000-4000-8000-0000000000d2";
export const handler = makeHandler({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Dal Makhani thali", price_paise: 14000, available: true }, [D2]: { id: D2, name: "Masala chai", price_paise: 3000, available: false } }, options: {} }),
  rules: async () => DEFAULT_RULES,
  coupon: async (c) => (c === "FLAT50" ? { code: "FLAT50", title: "Rs 50 off", kind: "flat", amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 0, first_order_only: false } : null),
  coupons: async () => [{ code: "FLAT50", title: "Rs 50 off", kind: "flat" as const, amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 0, first_order_only: false }],
  session: async (req) => (req.headers.get("authorization") ? "s1" : null),
  validate: async () => ({ ok: true }),
  firstOrder: async () => false,
});
