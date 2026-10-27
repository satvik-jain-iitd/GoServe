// Story #343: the menu handler wired to a fixed menu, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  now: () => new Date("2026-10-27T10:00:00Z"),
  rows: async () => [
    { id: "7e57ab1e-0000-4000-8000-0000000000d1", name: "Dal Makhani thali", price_paise: 14000, available: true, veg: true, category: "Thali", sort: 1, image_url: null, badge: "bestseller", size_tag: "regular", protein_g: 18, back_soon_at: null, created_at: "2026-09-01T00:00:00Z" },
    { id: "7e57ab1e-0000-4000-8000-0000000000d2", name: "Masala chai", price_paise: 3000, available: false, veg: true, category: null, sort: 9, image_url: null, badge: null, size_tag: "small", protein_g: null, back_soon_at: "2026-10-27T12:00:00Z", created_at: "2026-10-26T00:00:00Z" },
  ],
});
