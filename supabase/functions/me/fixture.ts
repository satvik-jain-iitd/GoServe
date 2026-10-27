// Story #340: the /me handler wired to fixed answers, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  session: async (req) => (req.headers.get("authorization") ? "7e57ab1e-0000-4000-8000-0000000000a1" : null),
  get: async () => ({ ok: true, profile: { name: "Asha", email: "asha@example.com" } }),
  set: async (_u, name) => (name === "Gone" ? { ok: false, error: "account_deleted", message: "This account was deleted." } : name === "x".repeat(81) ? { ok: false, error: "invalid_name", message: "Enter a name up to 80 letters." } : { ok: true }),
  remove: async () => ({ ok: true }),
});
