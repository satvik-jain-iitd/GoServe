// PLACEHOLDER (owner click): APNs — this file is empty on purpose (story #351). It is the one file to fill once the owner has an Apple Developer key (docs/product/founder-checklist.md).
// It must export `apns(): Push` (see push.ts) using APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY and APNS_TOPIC, then set PUSH_PROVIDER=real.
import type { Push } from "./push.ts";

export const apns = (): Push => {
  throw new Error("apns adapter not built yet: owner click pending");
};
