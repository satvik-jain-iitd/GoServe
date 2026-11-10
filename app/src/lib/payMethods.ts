// Story #1263 (epic #1259, board A10-PayMethods): the admin's payment methods switches and the UPI QR, and the rider's read of the QR.
// The database is the truth (migrations 20261110130000 and 20261110150000); the screens only show what it answers.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoorMethod } from "./doorMethods";

export type PayMethodsAdmin = { methods: DoorMethod[]; updated_by: string | null; updated_at: string };
export type QrAdmin = { object: string | null; updated_by: string | null; updated_at: string };

export async function readPayMethodsAdmin(c: Pick<SupabaseClient, "rpc">): Promise<PayMethodsAdmin> {
  const { data, error } = await c.rpc("payment_methods_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as PayMethodsAdmin;
}

/** The methods after the change, or a line to show. A refusal keeps the server's words ("One way to pay must stay on."). */
export async function setPayMethod(c: Pick<SupabaseClient, "rpc">, method: DoorMethod, on: boolean): Promise<{ methods: DoorMethod[] } | { line: string }> {
  const { data, error } = await c.rpc("payment_methods_set_v2", { p_method: method, p_on: on });
  if (error) return { line: "Could not save. Try again." };
  if (data?.ok === true && Array.isArray(data.methods)) return { methods: data.methods as DoorMethod[] };
  return { line: typeof data?.message === "string" ? data.message : "Could not save. Try again." };
}

export async function readQrAdmin(c: Pick<SupabaseClient, "rpc">): Promise<QrAdmin> {
  const { data, error } = await c.rpc("upi_qr_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as QrAdmin;
}

/** The public address of a QR object, built from this app's own project address: the database holds a name, never an address, so no other host can be shown. */
export const qrAddress = (object: string | null, base: string = import.meta.env.VITE_SUPABASE_URL): string | null =>
  object && /^qr-[0-9a-f-]{36}\.(png|jpg|webp)$/.test(object) ? `${base}/storage/v1/object/public/upi-qr/${object}` : null;

export const QR_MAX_BYTES = 2 * 1024 * 1024;
const QR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const qrFileProblem = (f: { type: string; size: number }): string | null =>
  !QR_TYPES[f.type] ? "Pick a PNG, JPG or WebP picture." : f.size > QR_MAX_BYTES ? "The picture is over 2 MB. Pick a smaller one." : null;

/** Uploads the picture as it is (a QR must not be shrunk) under a new name, then sets it. null when it worked, else a line to show. */
export async function uploadQr(c: Pick<SupabaseClient, "rpc" | "storage">, file: File): Promise<string | null> {
  const problem = qrFileProblem(file);
  if (problem) return problem;
  const path = `qr-${crypto.randomUUID()}.${QR_TYPES[file.type]}`;
  const up = await c.storage.from("upi-qr").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (up.error) return "The picture could not be uploaded. Try again.";
  const { data, error } = await c.rpc("upi_qr_set_v2", { p_object: path });
  if (error || data?.ok !== true) return "The picture was uploaded but could not be set. Try again.";
  return null;
}

/** The rider's read: the address of the QR the admin uploaded, or null (none yet, or the read failed). */
export async function readRiderQr(c: Pick<SupabaseClient, "rpc">): Promise<string | null> {
  try {
    const { data, error } = await c.rpc("upi_qr_object");
    return !error && typeof data === "string" ? qrAddress(data) : null;
  } catch {
    return null;
  }
}

/** What the Collect payment screen shows. The sample picture is for test and dev builds only (VITE_SAMPLE_QR=1); a prod build with no real QR shows no QR and no UPI button. */
export type QrChoice = { kind: "real"; src: string } | { kind: "sample"; src: string } | { kind: "none" };
export function qrChoice(url: string | null, sampleOn: boolean = import.meta.env.VITE_SAMPLE_QR === "1", base: string = import.meta.env.BASE_URL): QrChoice {
  if (url) return { kind: "real", src: url };
  return sampleOn ? { kind: "sample", src: `${base}qr-sample.svg` } : { kind: "none" };
}
