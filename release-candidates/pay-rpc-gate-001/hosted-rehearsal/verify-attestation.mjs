function value(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${flag}`);
  return process.argv[index + 1];
}

const url = new URL(value("--url"));
const expected = {
  commit: value("--commit"),
  tree: value("--tree"),
  projectId: value("--project-id"),
  appKey: value("--app-key"),
  appHost: value("--app-host").toLowerCase(),
  stage: value("--stage"),
  slices: value("--slices").split(",").filter(Boolean).map(Number),
};
const prohibitedHostIndex = process.argv.indexOf("--prohibited-host");
const prohibitedHost = prohibitedHostIndex >= 0 ? process.argv[prohibitedHostIndex + 1]?.toLowerCase() : null;
if (prohibitedHost && (url.hostname.toLowerCase() === prohibitedHost || expected.appHost === prohibitedHost)) {
  throw new Error("Attestation target is the prohibited host");
}

const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "error" });
const body = await response.json();
const failures = [];
if (!response.ok) failures.push(`HTTP_${response.status}`);
if (body?.format !== "GISP_RELEASE_ATTESTATION_V1") failures.push("FORMAT");
if (body?.bindingComplete !== true) failures.push("BINDING_INCOMPLETE");
if (body?.candidate?.commit !== expected.commit) failures.push("COMMIT");
if (body?.candidate?.tree !== expected.tree) failures.push("TREE");
if (body?.target?.projectId !== expected.projectId) failures.push("PROJECT_ID");
if (body?.target?.backendAppKey !== expected.appKey) failures.push("APP_KEY");
if (body?.target?.appHost !== expected.appHost || url.hostname.toLowerCase() !== expected.appHost) failures.push("APP_HOST");
if (body?.release?.stage !== expected.stage) failures.push("STAGE");
if (JSON.stringify(body?.release?.enabledDSlices) !== JSON.stringify(expected.slices)) failures.push("SLICES");
if (body?.serverAdminProbeOk !== true) failures.push("ADMIN_PROBE");
if (failures.length) throw new Error(`Release attestation failed: ${failures.join(",")}`);

// Safe to redirect to an evidence file: the endpoint contract contains no key,
// token, cookie, secret hash, business row or credential material.
process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
