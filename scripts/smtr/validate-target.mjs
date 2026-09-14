import { loadDevelopmentTarget } from "./target-guard.mjs";

// Pure local validation only. No SDK import and no network request.
const target = loadDevelopmentTarget();
console.log(JSON.stringify({ result: "PASS", environment: target, networkMutation: false }, null, 2));
