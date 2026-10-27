// PLACEHOLDER (owner click): FCM — this file is empty on purpose (story #351). It is the one file to fill once the owner has a Firebase project (docs/product/founder-checklist.md).
// It must export `fcm(): Push` (see push.ts) using FCM_SERVICE_ACCOUNT, then set PUSH_PROVIDER=real.
import type { Push } from "./push.ts";

export const fcm = (): Push => {
  throw new Error("fcm adapter not built yet: owner click pending");
};
