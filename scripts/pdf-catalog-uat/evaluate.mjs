#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { evaluatePdfCatalogUat } from "./evaluator-core.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
}

try {
  const groundTruthPath = argument("--ground-truth");
  const resultsPath = argument("--results");
  const outputPath = argument("--output");
  if (!groundTruthPath || !resultsPath) throw new Error("Usage: node scripts/pdf-catalog-uat/evaluate.mjs --ground-truth <approved.json> --results <export.json> [--output <report.json>]");
  const report = evaluatePdfCatalogUat(readJson(groundTruthPath), readJson(resultsPath));
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
  }
  process.stdout.write(serialized);
  process.exitCode = report.pass ? 0 : 1;
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "INVALID_UAT_INPUT", message: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exitCode = 2;
}
