import { createHash } from "node:crypto";import { readFileSync,readdirSync } from "node:fs";import { resolve } from "node:path";
const root=resolve("release-candidates/go-live-mvp-initial-operations-01-lean"), migrations=resolve(root,"migrations");
const files=readdirSync(migrations).sort();if(files.length!==12)throw new Error("LEAN_MIGRATION_COUNT_MISMATCH");
const canonical=readFileSync(resolve("migrations/20260923090000_startup_initial_operations_guard.sql"));const mirror=readFileSync(resolve(migrations,"20260923090000_startup_initial_operations_guard.sql"));if(!canonical.equals(mirror))throw new Error("LEAN_GUARD_MIRROR_MISMATCH");
const hash=createHash("sha256").update(mirror).digest("hex").toUpperCase();const manifest=readFileSync(resolve(root,"CANDIDATE-MANIFEST.md"),"utf8");if(!manifest.includes(hash))throw new Error("LEAN_GUARD_HASH_NOT_PINNED");
process.stdout.write(`LEAN_LOCAL_PACKAGE_OK migrations=${files.length} guard=${hash}\n`);
