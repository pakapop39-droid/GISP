const allowed = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
} as const;

export type SafeCustomRequestExtension = keyof typeof allowed;

export async function validateCustomRequestUpload(file: File): Promise<SafeCustomRequestExtension | null> {
  const extension = (file.name.split(".").pop() ?? "").toLowerCase() as SafeCustomRequestExtension;
  const expected = allowed[extension];
  if (!expected || file.type.toLowerCase() !== expected.mime) return null;
  const bytes = new Uint8Array(await file.slice(0, expected.magic.length).arrayBuffer());
  if (bytes.length !== expected.magic.length || expected.magic.some((value, index) => bytes[index] !== value)) return null;
  return extension;
}
