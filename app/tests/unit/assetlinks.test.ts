// Story #1342: the Play app is signed by Google (Play App Signing), so assetlinks.json must list both the upload key and the Play App Signing key for the customer app,
// or the installed app shows a browser bar. The other apps are untouched.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const links = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8")) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];
const of = (pkg: string) => links.find((l) => l.target.package_name === pkg)!.target.sha256_cert_fingerprints;

describe("assetlinks.json", () => {
  it("S1 the customer app lists exactly the upload key and the Play App Signing key", () => {
    expect(of("in.goserve.customer")).toEqual([
      "A7:4F:E2:AC:28:84:A3:62:85:D4:54:28:53:83:99:FD:B0:D7:0F:94:54:BE:14:D7:B7:47:9F:64:F2:BE:91:34",
      "7B:0C:09:94:04:07:59:D6:C6:17:A2:2B:CC:C8:5E:AD:0C:FC:C6:64:10:D6:5E:B9:C5:94:22:9A:0B:39:80:4A",
    ]);
  });
  it("S2 every fingerprint is 32 hex bytes with colons", () => {
    for (const f of of("in.goserve.customer")) expect(f).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
  it("S3 the other role apps are unchanged (no fingerprint yet)", () => {
    for (const pkg of ["in.goserve.kitchen", "in.goserve.rider", "in.goserve.admin"]) expect(of(pkg)).toEqual([]);
  });
});
