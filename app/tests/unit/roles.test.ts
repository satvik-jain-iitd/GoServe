// Story #83: each role is its own installable app on one origin. The address picks the app; each app has its own manifest.
import { describe, expect, it } from "vitest";
import { ROLE_APPS, roleFromPath } from "../../src/lib/roles";
import { roleManifest } from "../../src/pwa-manifest";

describe("roleFromPath", () => {
  it("S2 each app address picks its role, with or without a trailing slash", () => {
    expect(roleFromPath("/customer/")).toBe("customer");
    expect(roleFromPath("/customer")).toBe("customer");
    expect(roleFromPath("/kitchen/")).toBe("kitchen");
    expect(roleFromPath("/rider/")).toBe("rider");
    expect(roleFromPath("/ops/")).toBe("ops");
  });
  it("S2 the root (the demo console), the health page and anything else pick no app", () => {
    for (const p of ["/", "", "/health", "/kitchenette", "/kitchen/extra", "/Kitchen/"]) expect(roleFromPath(p)).toBeNull();
  });
  it("the four apps are customer, kitchen, rider and ops", () => {
    expect(ROLE_APPS).toEqual(["customer", "kitchen", "rider", "ops"]);
  });
});

describe("roleManifest", () => {
  const all = ROLE_APPS.map((r) => roleManifest(r));
  it("S2 every app has its own name, install identity and scope, and starts inside its scope", () => {
    expect(new Set(all.map((m) => m.id)).size).toBe(4);
    expect(new Set(all.map((m) => m.scope)).size).toBe(4);
    expect(new Set(all.map((m) => m.name)).size).toBe(4);
    for (const m of all) {
      expect(m.start_url.startsWith(m.scope)).toBe(true);
      expect(m.display).toBe("standalone");
      expect(m.icons.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("S2 the names say the role", () => {
    expect(all.map((m) => m.name)).toEqual(["GoServe", "GoServe Kitchen", "GoServe Rider", "GoServe Ops"]);
    expect(roleManifest("kitchen")).toMatchObject({ id: "/kitchen/", scope: "/kitchen/", start_url: "/kitchen/", short_name: "Kitchen" });
  });
});
