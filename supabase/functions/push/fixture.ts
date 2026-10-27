// Story #351: the push handler wired to FakePush and fixed answers, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";
import { FakePush } from "../_shared/push.ts";

export const CONTRACT_SECRET = "contract-secret";
export const handler = makeHandler({
  session: async (req) => (req.headers.get("authorization") ? "7e57ab1e-0000-4000-8000-0000000000a1" : null),
  push: new FakePush(),
  register: async () => ({ ok: true }),
  job: async (order) => (order.endsWith("dead")
    ? { ok: false, error: "order_not_found", message: "This order was not found." }
    : { ok: true, status: "accepted", devices: [{ platform: "android", token: "tok-a" }] }),
  forget: async () => {},
  secret: () => CONTRACT_SECRET,
});
