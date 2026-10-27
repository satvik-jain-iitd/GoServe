// Story #339: the otp handler wired to the FakeSms double and fixed answers, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  session: async (req) => (req.headers.get("authorization") ? "7e57ab1e-0000-4000-8000-0000000000a1" : null),
  issue: async (phone) => (phone === "9000000000" ? { ok: false, error: "too_many_sends", message: "Too many codes. Try again in a few minutes." } : { ok: true, code: "482913", expires_in_s: 600 }),
  sms: async () => {},
  check: async (_phone, code) => (code === "482913" ? { ok: true, phone: "919876543210" } : { ok: false, error: "wrong_code", message: "That code is not right." }),
  link: async () => ({ ok: true }),
});
