// Story #355: GET /help, the topics with their questions and answers. The data source is injected, so these tests need no network.
// Scenario: Given the faq table, when help is asked, then topics with questions and answers return.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const topics = [{ topic: "Ordering", items: [{ question: "How do I place an order?", answer: "Add dishes and tap Place order." }] }];
const deps = (o: Partial<Deps> = {}): Deps => ({ topics: async () => topics, ...o });
const get = (h: ReturnType<typeof makeHandler>, method = "GET") => h(new Request("https://x.test/help", { method }));

Deno.test("GET /help answers the topics with their questions and answers (the scenario)", async () => {
  const res = await get(makeHandler(deps()));
  assertEquals([res.status, await res.json()], [200, { ok: true, topics }]);
});

Deno.test("no questions: 200 and an empty list", async () => {
  assertEquals(await (await get(makeHandler(deps({ topics: async () => [] })))).json(), { ok: true, topics: [] });
});

Deno.test("a dead database is 502 with no detail", async () => {
  const res = await get(makeHandler(deps({ topics: () => Promise.reject(new Error("host=10.0.0.1")) })));
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "help_unavailable" }]);
});

Deno.test("anything but GET is 405", async () => {
  const res = await get(makeHandler(deps()), "POST");
  assertEquals([res.status, res.headers.get("allow")], [405, "GET"]);
});
