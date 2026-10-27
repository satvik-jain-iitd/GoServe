// Story #355: the help handler wired to a fixed list, for the contract test (api/contract.test.ts). Never deployed: the folder's only function file is index.ts.
import { makeHandler } from "./index.ts";

export const handler = makeHandler({
  topics: async () => [{ topic: "Ordering", items: [{ question: "How do I place an order?", answer: "Add dishes and tap Place order." }] }],
});
