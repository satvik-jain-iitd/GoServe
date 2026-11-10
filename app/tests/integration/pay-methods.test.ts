// Story #1263: the pure parts of the payment settings. The QR choice never shows the sample unless the build says so.
import { describe, expect, it } from "vitest";
import { qrChoice, qrFileProblem, QR_MAX_BYTES } from "../../src/lib/payMethods";

describe("qrChoice", () => {
  it("shows the real QR when one is set, whatever the build says", () => {
    expect(qrChoice("https://x/storage/v1/object/public/upi-qr/a.png", false, "/")).toEqual({ kind: "real", src: "https://x/storage/v1/object/public/upi-qr/a.png" });
    expect(qrChoice("https://x/storage/v1/object/public/upi-qr/a.png", true, "/")).toMatchObject({ kind: "real" });
  });
  it("shows the sample only when the build allows it", () => {
    expect(qrChoice(null, true, "/rider/")).toEqual({ kind: "sample", src: "/rider/qr-sample.svg" });
  });
  it("shows nothing on a prod build with no real QR", () => {
    expect(qrChoice(null, false, "/")).toEqual({ kind: "none" });
  });
});

describe("qrFileProblem", () => {
  it("takes PNG, JPG and WebP up to 2 MB and refuses the rest with a plain line", () => {
    expect(qrFileProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(qrFileProblem({ type: "image/jpeg", size: QR_MAX_BYTES })).toBeNull();
    expect(qrFileProblem({ type: "image/svg+xml", size: 10 })).toBe("Pick a PNG, JPG or WebP picture.");
    expect(qrFileProblem({ type: "image/png", size: QR_MAX_BYTES + 1 })).toBe("The picture is over 2 MB. Pick a smaller one.");
  });
});
