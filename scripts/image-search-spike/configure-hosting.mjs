// Configure only the dedicated Development website. Never print environment values.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
const deploy = path.resolve("output/image-search-deploy");
const linked = JSON.parse(await fs.readFile(path.join(deploy, ".vercel/project.json"), "utf8"));
if (linked.projectName !== "gisp-image-search-development" || process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app") throw Error("Development targets required");
let secret;
try { secret = (await fs.readFile(".env.image-search-online.local", "utf8")).match(/^IMAGE_SEARCH_CRON_SECRET=(.+)$/m)?.[1]; } catch {}
if (!secret) {
  secret = randomBytes(32).toString("hex");
  await fs.writeFile(".env.image-search-online.local", `ENABLE_IMAGE_SEARCH=true\nIMAGE_SEARCH_CRON_SECRET=${secret}\n`);
}
const values = {
  NEXT_PUBLIC_APP_URL: "https://gisp-image-search-development.vercel.app",
  NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
  NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  INSFORGE_URL: process.env.INSFORGE_URL,
  INSFORGE_API_KEY: process.env.INSFORGE_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  ENABLE_IMAGE_SEARCH: "true",
  IMAGE_SEARCH_CRON_SECRET: secret,
};
for (const [name, value] of Object.entries(values)) {
  if (!value) throw Error(`Missing ${name}`);
  await new Promise((resolve, reject) => {
    const sensitive = !name.startsWith("NEXT_PUBLIC_") && (name.endsWith("KEY") || name.endsWith("SECRET"));
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `npx -y vercel env add ${name} production --force --yes ${sensitive ? "--sensitive" : "--no-sensitive"}`], { cwd: deploy, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; }); child.stdin.end(value);
    child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(Error(`Environment setup failed for ${name}: ${code}; ${output.replaceAll(value, "[redacted]").slice(-1600)}`)));
  });
  console.log(`Configured ${name}`);
}
