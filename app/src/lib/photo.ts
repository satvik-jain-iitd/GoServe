// Story #921: a dish photo is shrunk on the phone before it is uploaded: longest side 800 px, WebP quality 0.8, canvas API, no library.
// Nothing is refused: a picture the browser cannot decode or encode, or one that would not get smaller, goes up as it is.
export const MAX_SIDE = 800;

export const fitSize = (w: number, h: number, max = MAX_SIDE): { width: number; height: number } => {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
};

export async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const { width, height } = fitSize(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    const blob: Blob | null = await new Promise((done) => canvas.toBlob(done, "image/webp", 0.8));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;   // no WebP here, or no gain: keep the original
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;   // not decodable: upload it as it is
  }
}
