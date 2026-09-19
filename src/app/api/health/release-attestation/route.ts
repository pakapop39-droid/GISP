import { NextResponse } from "next/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export const dynamic = "force-dynamic";

const shaPattern = /^[a-f0-9]{40}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appKeyPattern = /^[a-z0-9][a-z0-9-]{2,62}$/;
const backendHostPattern = /^([a-z0-9][a-z0-9-]{2,62})\.ap-southeast\.insforge\.app$/;

function hostname(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function backendHostFromUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
      || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    const host = parsed.hostname.toLowerCase();
    return backendHostPattern.test(host) ? host : null;
  } catch {
    return null;
  }
}

function configuredBackendHost(value: string | undefined) {
  const host = value?.trim().toLowerCase() ?? "";
  return backendHostPattern.test(host) ? host : null;
}

function releaseSlices(value: string | undefined) {
  if (!value) return [];
  const slices = value.split(",").map((item) => Number(item.trim()));
  if (slices.some((item) => !Number.isInteger(item))) return [];
  const canonical = [7, 8, 9, 10].slice(0, slices.length);
  return slices.length > 0 && slices.every((item, index) => item === canonical[index]) ? slices : [];
}

async function probeServerAdmin() {
  try {
    // head:true proves the server credential can reach the bound backend without
    // returning application rows (or counts) through the attestation endpoint.
    const result = await createInsForgeAdminClient().database
      .from("file_metadata")
      .select("id", { head: true })
      .limit(1);
    return !result.error;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const commit = process.env.RELEASE_CANDIDATE_COMMIT ?? null;
  const tree = process.env.RELEASE_CANDIDATE_TREE ?? null;
  const projectId = process.env.RELEASE_TARGET_PROJECT_ID ?? null;
  const targetBackendHost = configuredBackendHost(process.env.RELEASE_TARGET_BACKEND_HOST);
  const targetAppKey = process.env.RELEASE_TARGET_APP_KEY?.trim().toLowerCase() ?? null;
  const serverBackendHost = backendHostFromUrl(process.env.INSFORGE_URL);
  const publicBackendHost = backendHostFromUrl(process.env.NEXT_PUBLIC_INSFORGE_URL);
  const appHost = hostname(process.env.NEXT_PUBLIC_APP_URL);
  const requestHost = hostname(request.url);
  const stage = process.env.RELEASE_STAGE ?? null;
  const slices = releaseSlices(process.env.RELEASE_D_ENABLED_SLICES);
  const identityBindingComplete = Boolean(
    commit && shaPattern.test(commit)
    && tree && shaPattern.test(tree)
    && projectId && uuidPattern.test(projectId)
    && targetBackendHost
    && targetAppKey && appKeyPattern.test(targetAppKey)
    && targetBackendHost === `${targetAppKey}.ap-southeast.insforge.app`
    && serverBackendHost === targetBackendHost
    && publicBackendHost === targetBackendHost
    && appHost
    && appHost === requestHost
    && (stage === "C" || stage === "D")
    && (stage === "C" ? slices.length === 0 : slices.length > 0),
  );
  // Never construct an admin client until every non-secret identity value binds
  // to the exact authorized Child. A malformed URL must not receive a request
  // carrying the server credential.
  const adminProbeOk = identityBindingComplete ? await probeServerAdmin() : false;
  const bindingComplete = identityBindingComplete && adminProbeOk;

  return NextResponse.json({
    format: "GISP_RELEASE_ATTESTATION_V1",
    bindingComplete,
    candidate: { commit, tree },
    target: {
      projectId,
      backendHost: targetBackendHost,
      backendAppKey: targetAppKey,
      appHost,
      requestHost,
    },
    release: { stage, enabledDSlices: slices },
    serverAdminProbeOk: adminProbeOk,
  }, {
    status: bindingComplete ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
