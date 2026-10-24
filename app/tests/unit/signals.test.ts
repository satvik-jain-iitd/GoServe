// Story H14 (#204): the signals the pilot numbers need. The phone platform, and the rider's "Not delivered" button.
import { describe, expect, it } from "vitest";
import { clientPlatform } from "../../src/lib/platform";
import { riderActions } from "../../src/lib/kitchen";

describe("clientPlatform", () => {
  it("reads iPhone and iPad as ios, Android as android, anything else as other", () => {
    expect(clientPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe("ios");
    expect(clientPlatform("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15")).toBe("ios");
    expect(clientPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36")).toBe("android");
    expect(clientPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36")).toBe("other");
    expect(clientPlatform("")).toBe("other");
  });
});

describe("riderActions", () => {
  it("an order on the way can be arriving, delivered or not delivered", () => {
    expect(riderActions("out_for_delivery").map((a) => a.label)).toEqual(["Arriving", "Delivered", "Not delivered"]);
    expect(riderActions("ready").map((a) => a.label)).toEqual(["Pick up"]);
  });
});
