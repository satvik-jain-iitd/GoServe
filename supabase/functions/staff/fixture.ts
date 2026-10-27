// Story #468: the staff handler wired to fixed answers, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

const KB = "7e57ab1e-0000-4000-8000-0000000000b2";
export const handler = makeHandler({
  session: async (req) => (req.headers.get("authorization") ? "7e57ab1e-0000-4000-8000-0000000000a1" : null),
  mine: async () => ({ ok: true, kitchens: [{ kitchen_id: "7e57ab1e-0000-4000-8000-0000000000b1", name: "A", role: "owner" }, { kitchen_id: KB, name: "B", role: "staff" }] }),
  add: async (_a, kitchen, _u, role) => (kitchen.endsWith("dead") ? { ok: false, error: "kitchen_not_found", message: "This kitchen was not found." } : role === "boss" ? { ok: false, error: "invalid_role", message: "The role is owner or staff." } : kitchen.endsWith("f0") ? { ok: false, error: "not_allowed", message: "Only an admin can change who works in a kitchen." } : { ok: true }),
  remove: async () => ({ ok: true }),
});
