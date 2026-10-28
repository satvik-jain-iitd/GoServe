// Story #642: the words of the cards are the owner's words, word for word.
import { describe, expect, it } from "vitest";
import { SAVED_CARD, SENT_CARD } from "../../src/lib/feedback";

describe("feedback cards", () => {
  it("say what the story says", () => {
    expect(SENT_CARD).toEqual({ title: "Sent. Thank you.", line: "The GoServe team reads every note. Yours makes the app better for everyone." });
    expect(SAVED_CARD).toEqual({ title: "Saved on this phone.", line: "It goes to the team the moment you are back online." });
  });
});
