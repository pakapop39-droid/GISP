export const sourcingImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

export const sourcingImageMaxBytes = 10 * 1024 * 1024;

export function hasValidImageSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function validateSourcingImage(file: File) {
  const extension = sourcingImageTypes.get(file.type as "image/jpeg" | "image/png" | "image/webp");
  if (!extension || file.size <= 0 || file.size > sourcingImageMaxBytes) return null;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return hasValidImageSignature(file.type, header) ? extension : null;
}
