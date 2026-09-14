import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FinishImportSource } from "./finish-import";

const tokenVersion = 1;
export const finishImportPreviewTtlMs = 10 * 60 * 1000;

type PreviewClaims = {
  v: number;
  fileHash: string;
  supplierId: string;
  payloadHash: string;
  expiresAt: number;
};

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const payloadDigest = (rows: Array<{ rowNumber: number; source: FinishImportSource }>) =>
  digest(JSON.stringify(rows.map((row) => ({ rowNumber: row.rowNumber, source: row.source }))));

export function createFinishImportPreviewToken(input: {
  fileBytes: Uint8Array;
  supplierId: string;
  rows: Array<{ rowNumber: number; source: FinishImportSource }>;
  signingKey: string;
  now?: number;
}) {
  const expiresAt = (input.now ?? Date.now()) + finishImportPreviewTtlMs;
  const claims: PreviewClaims = {
    v: tokenVersion,
    fileHash: digest(input.fileBytes),
    supplierId: input.supplierId,
    payloadHash: payloadDigest(input.rows),
    expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", input.signingKey).update(encoded).digest("base64url");
  return { previewToken: `${encoded}.${signature}`, expiresAt };
}

export function verifyFinishImportPreviewToken(input: {
  previewToken: string;
  fileBytes: Uint8Array;
  supplierId: string;
  rows: Array<{ rowNumber: number; source: FinishImportSource }>;
  signingKey: string;
  now?: number;
}) {
  const [encoded, suppliedSignature, extra] = input.previewToken.split(".");
  if (!encoded || !suppliedSignature || extra) return false;
  const expectedSignature = createHmac("sha256", input.signingKey).update(encoded).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PreviewClaims;
    return claims.v === tokenVersion
      && claims.expiresAt >= (input.now ?? Date.now())
      && claims.fileHash === digest(input.fileBytes)
      && claims.supplierId === input.supplierId
      && claims.payloadHash === payloadDigest(input.rows);
  } catch {
    return false;
  }
}
