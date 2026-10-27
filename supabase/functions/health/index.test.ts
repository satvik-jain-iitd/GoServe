// Story #337 (E27, plan v2 B.1). Scenario: Given the dev project, when CI runs, then the health function is deployed and answers.
// This test is the "answers" half: the handler says ok to a GET and refuses everything else. The deploy half is the CI job (.github/workflows/backend.yml).
import { assertEquals } from "jsr:@std/assert@1";
import { handler } from "./index.ts";

Deno.test("a GET answers 200 with ok true and the service name", async () => {
  const res = await handler(new Request("https://x.test/health"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.service, "health");
  assertEquals(typeof body.time, "string");
});

Deno.test("anything but GET or HEAD is refused with 405 and an Allow header", async () => {
  for (const method of ["POST", "PUT", "DELETE"]) {
    const res = await handler(new Request("https://x.test/health", { method }));
    assertEquals(res.status, 405, method);
    assertEquals(res.headers.get("allow"), "GET, HEAD");
    await res.body?.cancel();
  }
});

Deno.test("the answer says nothing about the project, keys or the database", async () => {
  const text = await (await handler(new Request("https://x.test/health"))).text();
  assertEquals(Object.keys(JSON.parse(text)).sort(), ["ok", "service", "time"]);
});
