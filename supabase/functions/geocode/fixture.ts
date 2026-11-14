// Story #998: the geocode handler wired to one fixed Ola answer, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  session: async () => "7e57ab1e-0000-4000-8000-000000000002",
  provider: async () => "ola",
  allow: () => true,
  cap: async () => "ok",
  budget: async () => true,
  lookup: async () => ({ results: [{ formatted_address: "Radio Colony, Chhatarpur, Madhya Pradesh 471001, India", address_components: [
    { types: ["postal_code"], long_name: "471001", short_name: "471001" }, { types: ["sublocality"], long_name: "Radio Colony", short_name: "Radio Colony" },
    { types: ["locality"], long_name: "Chhatarpur", short_name: "Chhatarpur" }, { types: ["administrative_area_level_1"], long_name: "Madhya Pradesh", short_name: "MP" }] }] }),
});
