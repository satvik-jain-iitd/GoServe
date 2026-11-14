// Story #1027: the place-search handler wired to one fixed answer (story #1029: from the table), for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  session: async () => "7e57ab1e-0000-4000-8000-000000000002",
  allow: () => true,
  cap: async () => "ok", radius: async () => 25_000,
  ola: async () => [],   // story 1519: no Ola in the contract test; the backup table answers
  lookup: async () => [{ pin: "110016", place: "Green Park", state: "Delhi", lat: 28.5599, lng: 77.2065 }],
  served: async () => true,
});
