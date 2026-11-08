// Story #1027: the place-search handler wired to one fixed answer, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  session: async () => "7e57ab1e-0000-4000-8000-000000000002",
  allow: () => true,
  cached: async () => null,
  save: async () => {},
  slot: async () => true,
  viewbox: async () => null,
  search: async () => [{ name: "Green Park Metro Station", display_name: "Green Park Metro Station, Aurobindo Marg, New Delhi, Delhi, 110016, India", lat: "28.5599", lon: "77.2065", address: { postcode: "110016" } }],
  served: async () => true,
});
