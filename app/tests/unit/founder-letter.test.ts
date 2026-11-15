// Story 1563: the shared text of the co-founder's letter keeps the letter's lines, with WhatsApp bold on the title and the motto only.
import { describe, expect, it } from "vitest";
import { letterText } from "../../src/lib/founderLetter";

describe("The shared text keeps the letter's lines", () => {
  it("with the promise: the first line, the title, each paragraph, the motto, the name and the address, one blank line between them", () => {
    expect(letterText("Sector 62", 10000)).toBe(
      "A letter from co-founder Satvik Jain\n\n" +
      "*You found us early. Thank you.*\n\n" +
      "We don't reach Sector 62 yet. I am sorry you came all this way for nothing today.\n\n" +
      "We are a small, new kitchen, and we are growing fast. You trusted us first. That means a lot to me.\n\n" +
      "So here is my promise: the day we open in Sector 62, your first order is ₹100 off. We will message you.\n\n" +
      "At GoServe we have one rule.\n\n" +
      "*Pahle banda, phir dhanda.*\nPeople first, business after.\n\n" +
      "Satvik\n\n" +
      "https://letsdwelo.in/");
  });

  it("no promise on the stored row: no promise paragraph", () => {
    const text = letterText("Sector 62", null);
    expect(text).not.toContain("promise");
    expect(text.split("\n\n").length).toBe(8);
  });

  it("no star sits next to a space, and only the title and the motto's first line are bold", () => {
    const text = letterText("Sector 62", 10000);
    expect(text).not.toMatch(/\* | \*/);
    expect(text.match(/\*[^*\n]+\*/g)).toEqual(["*You found us early. Thank you.*", "*Pahle banda, phir dhanda.*"]);
  });
});
