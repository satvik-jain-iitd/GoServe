// Story #351: the seam. With PUSH_PROVIDER=real the placeholder files fcm.ts and apns.ts must be filled; this test fails while they are not.
// It needs --allow-env, so CI (which has no env switch set) skips it; the owner's switch run has the variable and the permission.
import { assert } from "jsr:@std/assert@1";
import { FakePush, pushFromEnv } from "./push.ts";

const envReadable = Deno.permissions.querySync({ name: "env" }).state === "granted";

Deno.test({ name: "seam: the default is FakePush; with PUSH_PROVIDER=real the adapters must exist", ignore: !envReadable, fn: async () => {
  const push = await pushFromEnv();   // throws "...owner click pending" while fcm.ts or apns.ts is still the placeholder
  if (Deno.env.get("PUSH_PROVIDER") === "real") assert(!(push instanceof FakePush));
  else assert(push instanceof FakePush);
} });

Deno.test("FakePush records a send and answers gone only for a dead token", async () => {
  const f = new FakePush();
  f.gone.add("dead");
  assert(!(await f.send("ios", "ok", { title: "t", body: "b" })).gone);
  assert((await f.send("android", "dead", { title: "t", body: "b" })).gone);
  assert(f.sent.length === 1 && f.sent[0].platform === "ios");
});
