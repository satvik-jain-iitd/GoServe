// Story #346: the coupons handler wired to a fixed list, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  list: async () => [{ code: "FLAT50", title: "Rs 50 off", kind: "flat", amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 20000, first_order_only: false }],
});
