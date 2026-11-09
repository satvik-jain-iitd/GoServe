// Story #975: the customer bar has two tabs, Delivery and History; the greeting sentence is gone.
import { describe, it, expect } from "vitest";
import * as home from "../../src/lib/home";
import { CUSTOMER_TABS } from "../../src/ui";

describe("customer tabs", () => {
  it("are Delivery and History only", () => expect(CUSTOMER_TABS.map((t: { name: string }) => t.name)).toEqual(["Delivery", "History"]));
  it("the home lib has no greeting any more", () => expect("greeting" in home).toBe(false));
});
