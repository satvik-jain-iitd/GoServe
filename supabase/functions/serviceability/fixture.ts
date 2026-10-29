// Story #342: the serviceability handler wired to one fixed kitchen, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  now: () => new Date("2026-10-27T06:30:00Z"),
  kitchens: async () => [{ id: "7e57ab1e-0000-4000-8000-000000000001", name: "Hauz Khas Kitchen", lat: 28.5494, lng: 77.2001, radius_m: 3000, prep_minutes: 20, open: true, active: true, opens_at: null, closes_at: null }],
});
