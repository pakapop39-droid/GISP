// Run after the dedicated Development deployment passes its worker smoke test.
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app" || !process.env.IMAGE_SEARCH_CRON_SECRET) throw Error("Development environment required");
const endpoint = "https://gisp-image-search-development.vercel.app/api/internal/image-search/process";
const smoke = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${process.env.IMAGE_SEARCH_CRON_SECRET}` }, signal: AbortSignal.timeout(240000) });
if (!smoke.ok) throw Error(`Worker smoke HTTP ${smoke.status}; schedule not changed`);
console.log("Worker endpoint verified");
async function cli(command, allowFailure = false) {
  return new Promise((resolve, reject) => {
    let stdout = "", stderr = "";
    // PowerShell 7 preserves JSON argument quotes for native CLI commands.
    const child = spawn("pwsh.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", b => { stdout += b; }); child.stderr.on("data", b => { stderr += b; });
    child.on("error", reject); child.on("exit", code => {
      let parsed; try { parsed = JSON.parse(stdout.trim()); } catch {}
      if (allowFailure && (code || !parsed || parsed.error)) return resolve(null);
      if (code || !parsed || parsed.error) return reject(Error(`Schedule setup failed (${code}): ${(stdout + stderr).replaceAll(process.env.IMAGE_SEARCH_CRON_SECRET, "[redacted]").slice(-1400)}`));
      resolve(parsed);
    });
  });
}
const existingSecret = await cli("npx -y @insforge/cli secrets get IMAGE_SEARCH_CRON_SECRET --json", true);
if (existingSecret && existingSecret.value !== process.env.IMAGE_SEARCH_CRON_SECRET) throw Error("Existing worker secret differs; refusing automatic rotation");
if (!existingSecret) await cli("npx -y @insforge/cli secrets add IMAGE_SEARCH_CRON_SECRET $env:IMAGE_SEARCH_CRON_SECRET --json");
const schedules = await cli("npx -y @insforge/cli schedules list --json");
const list = Array.isArray(schedules) ? schedules : schedules.data ?? [];
const existing = list.find(s => s.name === "GISP-Image-Search-Index");
const headerSetup = "$imageHeaders = '{\"Authorization\":\"Bearer ${{secrets.IMAGE_SEARCH_CRON_SECRET}}\"}'; ";
const action = existing ? `update ${existing.id} --active true` : "create --name GISP-Image-Search-Index";
const result = await cli(headerSetup + `npx -y @insforge/cli schedules ${action} --cron '*/5 * * * *' --url '${endpoint}' --method POST --headers $imageHeaders --json`);
const row = result.data ?? result;
const safe = { id: row.id ?? existing?.id, name: "GISP-Image-Search-Index", endpoint, cadence: "every 5 minutes", configuredAt: new Date().toISOString() };
await fs.writeFile("output/image-search-spike/schedule.json", JSON.stringify(safe, null, 2));
console.log(JSON.stringify(safe));
