import fs from "node:fs";
import path from "node:path";

export const OUTPUT_DIR = path.join(process.cwd(), "output", "smtr");
export const MANIFEST_PATH = path.join(OUTPUT_DIR, "SMTR-v1.0-manifest.json");
export const SETUP_REPORT_PATH = path.join(OUTPUT_DIR, "SMTR-v1.0-setup-report.json");
export const VERIFY_REPORT_PATH = path.join(OUTPUT_DIR, "SMTR-v1.0-verify-report.json");
export const CLEANUP_REPORT_PATH = path.join(OUTPUT_DIR, "SMTR-v1.0-cleanup-report.json");

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}
