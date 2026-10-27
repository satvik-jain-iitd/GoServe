// Story #351: the phone push service as an injected dependency. TEST DOUBLE: FakePush records every send; it reaches no phone.
// The real adapters are `fcm.ts` (Android) and `apns.ts` (iOS), both empty but named. When the owner's clicks are done (FCM project, Apple Developer key):
// fill those files, set PUSH_PROVIDER=real and the keys.
export type Platform = "android" | "ios";
export type Message = { title: string; body: string };
// gone = the push service says the token is dead (forget it); any other failure throws.
export type Push = { send: (platform: Platform, token: string, m: Message) => Promise<{ gone: boolean }> };

export class FakePush implements Push {
  sent: { platform: Platform; token: string; title: string; body: string }[] = [];
  gone = new Set<string>();
  broken = new Set<string>();
  send(platform: Platform, token: string, m: Message) {
    if (this.broken.has(token)) return Promise.reject(new Error("push service down"));
    if (this.gone.has(token)) return Promise.resolve({ gone: true });
    this.sent.push({ platform, token, ...m });
    return Promise.resolve({ gone: false });
  }
}

// PLACEHOLDER (owner click): FCM and APNs — swap `fcm.ts` and `apns.ts`, set PUSH_PROVIDER=real, FCM_SERVICE_ACCOUNT, APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY, APNS_TOPIC.
export const pushFromEnv = async (): Promise<Push> => {
  if (Deno.env.get("PUSH_PROVIDER") === "real") {
    const [{ fcm }, { apns }] = await Promise.all([import("./fcm.ts"), import("./apns.ts")]);
    const [a, i] = [fcm(), apns()];
    return { send: (platform, token, m) => (platform === "android" ? a : i).send(platform, token, m) };
  }
  return new FakePush();
};
