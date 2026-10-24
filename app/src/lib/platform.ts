// Story H14 (#204): the phone platform of an order, for the iPhone share in the pilot numbers.
export type Platform = "ios" | "android" | "other";
export const clientPlatform = (ua: string): Platform => (/iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other");
