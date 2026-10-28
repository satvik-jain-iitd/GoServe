// What the Feedback button builds, shrinks, queues and sends (story S-B, #94, ADR-014).
// The phone's own screenshot is the picture: there is no screenshot library. The words and the picture go to n8n (SUB 17), which saves them.
import { PlaceError } from "./orders";
import type { TrailEntry } from "./trail";

export const DOING = ["ordering", "cooking", "delivering", "watching ops", "installing", "other"] as const;
export type Doing = (typeof DOING)[number];
export const TEXT_MAX = 300;
export const IMAGE_MAX_PX = 1280;
export const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
// Story #642: the card after Send. Owner's words, kept in one place.
export const SENT_CARD = { title: "Sent. Thank you.", line: "The GoServe team reads every note. Yours makes the app better for everyone." };
export const SAVED_CARD = { title: "Saved on this phone.", line: "It goes to the team the moment you are back online." };
const QUEUE_KEY = "gs-feedback-queue";
const QUEUE_MAX = 5;

export type Report = {
  action: "feedback"; session_id: string; role: string; screen: string; order_id: string; doing: Doing; text: string;
  context: Record<string, unknown>; image_b64?: string;
};
type BuildInput = {
  text: string; doing: Doing; role: string; screen: string; session: string; order: { id: string; status: string } | null; build: string;
  phone: string; online: boolean; now: Date; trail: TrailEntry[]; image?: string;
};

export function buildPayload(i: BuildInput): Report {
  const text = i.text.trim().slice(0, TEXT_MAX);
  if (!text) throw new Error("Please tell us what happened.");
  const report: Report = {
    action: "feedback", session_id: i.session, role: i.role, screen: i.screen, order_id: i.order?.id ?? "", doing: i.doing, text,
    context: { order_status: i.order?.status ?? "", build: i.build, phone: i.phone, online: i.online, at: i.now.toISOString(), trail: i.trail },
  };
  if (i.image) report.image_b64 = i.image;
  return report;
}

// The long side is at most 1280 px; a small picture is never enlarged.
export function fitSize(w: number, h: number): { width: number; height: number } {
  const k = Math.min(1, IMAGE_MAX_PX / Math.max(w, h));
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

// Try a lower JPEG quality until the picture is at most 1.5 MB.
export async function shrinkToLimit(encode: (quality: number) => Promise<Blob>): Promise<Blob> {
  for (const q of [0.8, 0.65, 0.5, 0.35]) {
    const blob = await encode(q);
    if (blob.size <= IMAGE_MAX_BYTES) return blob;
  }
  throw new Error("That picture is too big. Take a new screenshot and try again.");
}

// Browser only: read the picked file, draw it at the fitted size, return the JPEG as base64 (no prefix).
export async function pictureToBase64(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const { width, height } = fitSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  const blob = await shrinkToLimit((q) => new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("no picture"))), "image/jpeg", q)));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const readQueue = (store: Storage): Report[] => {
  try {
    return JSON.parse(store.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
};
// Keep the report on the phone until it is online. If the phone has no room, keep the words and drop the picture. Returns false if nothing could be kept.
export function queueReport(store: Storage, report: Report): boolean {
  const next = [...readQueue(store), report].slice(-QUEUE_MAX);
  for (const keep of [next, next.map(({ image_b64: _drop, ...r }) => r as Report)]) {
    try {
      store.setItem(QUEUE_KEY, JSON.stringify(keep));
      return true;
    } catch { /* try again without the pictures */ }
  }
  return false;
}
// Send the queued reports in order. Stops at the first failure and keeps the rest. Returns how many are left.
export async function flushQueue(store: Storage, send: (r: Report) => Promise<unknown>): Promise<number> {
  const queue = readQueue(store);
  let sent = 0;
  for (const r of queue) {
    try {
      await send(r);
      sent++;
    } catch (e) {
      if (e instanceof PlaceError && e.code !== "network") sent++;   // the server refused this one for good; do not retry it forever
      else break;
    }
  }
  const left = queue.slice(sent);
  try {
    if (left.length) store.setItem(QUEUE_KEY, JSON.stringify(left));
    else store.removeItem(QUEUE_KEY);
  } catch { /* the queue stays as it was */ }
  return left.length;
}
