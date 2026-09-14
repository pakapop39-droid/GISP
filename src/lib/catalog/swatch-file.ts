const signatures = {
  jpg: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes: Uint8Array) => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value),
  webp: (bytes: Uint8Array) => bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
};

const mimeExtension = new Map<string, keyof typeof signatures>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function validatedSwatchExtension(file: File) {
  const extension = mimeExtension.get(file.type);
  if (!extension) return null;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return signatures[extension](bytes) ? extension : null;
}
