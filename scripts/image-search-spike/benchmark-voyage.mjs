// Paid, bounded experiment using the existing project gateway. Credentials are
// loaded by node --env-file=.env.local; never logged or embedded in artifacts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const root = path.resolve('output/image-search-spike');
const dataset = JSON.parse(await fs.readFile(path.join(root, 'dataset.json'), 'utf8'));
const modelId = 'voyageai/voyage-multimodal-3.5';
const resultDir = path.join(root, 'voyage-multimodal-3.5');
await fs.mkdir(resultDir, { recursive: true });
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing; use InsForge ai setup');
const config = JSON.parse(await fs.readFile('.insforge/project.json', 'utf8'));
if (config.appkey !== 'kit6y4pj') throw new Error('Development project required');
const headers = { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' };
const catalogResponse = await fetch('https://openrouter.ai/api/v1/embeddings/models', { headers, signal: AbortSignal.timeout(30000) });
if (!catalogResponse.ok) throw new Error(`Model discovery HTTP ${catalogResponse.status}`);
const selected = (await catalogResponse.json()).data.find(m => m.id === modelId);
if (!selected?.architecture?.input_modalities?.includes('image')) throw new Error('Model image input not confirmed');
const identity = `${selected.canonical_slug}:float1024:normalized-768-jpeg88-v1:input-type-none`;
const cachePath = path.join(resultDir, 'embeddings.json');
const ledgerPath = path.join(resultDir, 'ledger.json');
let cache = { identity, vectors: {} };
let ledger = { budgetUsd: 1, conservativeReservedUsd: 0, reportedCostUsd: 0, missingCostResponses: 0, requests: [] };
try { const previous = JSON.parse(await fs.readFile(cachePath, 'utf8')); if (previous.identity === identity) cache = previous; } catch {}
try { ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')); } catch {}
// Enforce no-training routing. Voyage currently has no ZDR route on OpenRouter;
// do not claim zero retention or change the project's account privacy settings.
const policy = { only: ['voyageai'], allow_fallbacks: false, data_collection: 'deny' };
const save = async () => {
  await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
  await fs.writeFile(cachePath, JSON.stringify(cache));
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function call(items, purpose) {
  // Pessimistic reservation per image exceeds the documented 2MP image maximum
  // plus an allowance for prompt overhead, even though files are <=768px.
  const reservation = items.length * .0013;
  if (ledger.conservativeReservedUsd + reservation > ledger.budgetUsd) throw new Error('Experiment budget reached');
  ledger.conservativeReservedUsd += reservation;
  const entry = { at: new Date().toISOString(), purpose, images: items.length, policy, status: 'started' };
  ledger.requests.push(entry);
  await save();
  const begin = performance.now();
  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST', headers, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ model: modelId, encoding_format: 'float', dimensions: 1024, provider: policy,
        input: items.map(item => ({ content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${item.bytes.toString('base64')}` } }] })),
      }),
    });
  } catch {
    entry.status = 'network-error'; entry.elapsedMs = performance.now() - begin; await save();
    throw new Error('Gateway network error; reservation retained, no automatic replay');
  }
  entry.elapsedMs = performance.now() - begin;
  entry.httpStatus = response.status;
  const body = await response.json();
  if (!response.ok || body.error) {
    entry.status = 'api-error'; entry.errorCode = body.error?.code ?? response.status; await save();
    console.log(JSON.stringify({ httpStatus: response.status, errorCode: entry.errorCode, message: String(body.error?.message ?? '').replace(/data:[^\s]+/g, '[redacted]').slice(0, 250) }));
    throw new Error('Gateway declined experiment request; policy not relaxed');
  }
  entry.status = 'ok'; entry.responseId = body.id ?? null; entry.model = body.model;
  entry.usage = body.usage ?? null;
  const cost = body.usage?.cost;
  if (typeof cost === 'number' && Number.isFinite(cost)) ledger.reportedCostUsd += cost;
  else ledger.missingCostResponses++;
  if (!Array.isArray(body.data) || body.data.length !== items.length) { await save(); throw new Error('Embedding count mismatch'); }
  const ordered = [...body.data].sort((a, b) => a.index - b.index);
  const vectors = ordered.map((row, i) => {
    if (row.index !== i || row.embedding?.length !== 1024 || !row.embedding.every(Number.isFinite)) throw new Error('Invalid embedding output');
    const length = Math.hypot(...row.embedding);
    if (!(length > 0)) throw new Error('Zero embedding');
    return row.embedding.map(v => v / length);
  });
  await save();
  return vectors;
}
const paths = [...new Set([...dataset.gallery.map(p => p.image.relative), ...dataset.queries.map(q => q.relative)])];
const items = [];
const pathHashes = new Map();
const seenHashes = new Set();
for (const relative of paths) {
  const bytes = await fs.readFile(path.join(root, relative));
  const key = hash(bytes); pathHashes.set(relative, key);
  if (!cache.vectors[key] && !seenHashes.has(key)) { items.push({ relative, bytes, hash: key }); seenHashes.add(key); }
}
// One-image smoke call confirms image payload, routing policy and dimensions
// before the whole gallery is sent. The result is cached and reused.
if (items.length) {
  const item = items.shift();
  const [vector] = await call([item], 'smoke'); cache.vectors[item.hash] = vector; await save();
  console.log(`Smoke passed: ${vector.length} dimensions, data_collection=deny requested; ZDR not asserted`);
}
if (process.argv.includes('--smoke-only')) {
  console.log(JSON.stringify({ status: 'SMOKE_COMPLETE', ledger }, null, 2)); process.exit(0);
}
for (let start = 0; start < items.length; start += 16) {
  const batch = items.slice(start, start + 16);
  const vectors = await call(batch, 'gallery-and-queries');
  for (let i = 0; i < batch.length; i++) cache.vectors[batch[i].hash] = vectors[i];
  await save();
  console.log(`Hosted embeddings ${Math.min(start + 16, items.length)}/${items.length}; reported $${ledger.reportedCostUsd.toFixed(6)}`);
}
const vectorAt = relative => cache.vectors[pathHashes.get(relative)];
function rank(vector) {
  return dataset.gallery.map(p => ({ productId: p.id, sku: p.sku, name: p.name, category: p.category, relative: p.image.relative,
    score: vectorAt(p.image.relative).reduce((n, v, i) => n + v * vector[i], 0),
  })).sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
}
const queries = dataset.queries.map(q => {
  const ranked = rank(vectorAt(q.relative));
  const expectedRank = ranked.findIndex(p => q.expectedProductIds.includes(p.productId)) + 1;
  const category = dataset.gallery.find(p => p.id === q.productId).category;
  const expectedCategoryRank = ranked.filter(p => p.category === category).findIndex(p => q.expectedProductIds.includes(p.productId)) + 1;
  return { ...q, expectedRank, expectedCategoryRank, top1Score: ranked[0].score,
    expectedScore: ranked[expectedRank - 1].score, top10: ranked.slice(0, 10),
    leakageProductIds: dataset.gallery.filter(p => p.image.normalizedSha256 === pathHashes.get(q.relative)).map(p => p.id) };
});
const metrics = [];
for (const split of ['calibration', 'holdout']) for (const kind of ['compressed', 'alternate-proxy']) {
  const list = queries.filter(q => q.split === split && q.kind === kind);
  const measure = qs => ({ total: qs.length, hit1: qs.filter(q => q.expectedRank === 1).length,
    hit5: qs.filter(q => q.expectedRank > 0 && q.expectedRank <= 5).length,
    hit10: qs.filter(q => q.expectedRank > 0 && q.expectedRank <= 10).length,
    categoryFilterHit10: qs.filter(q => q.expectedCategoryRank > 0 && q.expectedCategoryRank <= 10).length });
  metrics.push({ split, kind, ...measure(list), withoutByteLeakage: measure(list.filter(q => !q.leakageProductIds.length)) });
}
const timing = [];
for (const q of dataset.queries.slice(0, 20)) {
  const bytes = await fs.readFile(path.join(root, q.relative));
  const begin = performance.now(); const [vector] = await call([{ bytes }], 'single-query-timing'); rank(vector);
  timing.push(performance.now() - begin);
}
const percentile = (a, p) => [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1];
const summary = { runAt: new Date().toISOString(), modelId, revision: selected.canonical_slug, dtype: 'float', dimension: 1024,
  runtime: 'OpenRouter / Voyage AI by MongoDB', galleryProducts: dataset.gallery.length, queryCount: queries.length, metrics,
  hostedQueryMs: { n: timing.length, median: percentile(timing, .5), p95: percentile(timing, .95) },
  policy, threshold: null, absentProductEvaluation: 'NOT_RUN_NO_HUMAN_LABELS', similarProductEvaluation: 'NOT_RUN_NO_HUMAN_LABELS',
  reportedCostUsd: ledger.reportedCostUsd, missingCostResponses: ledger.missingCostResponses,
  conservativeReservedUsd: ledger.conservativeReservedUsd,
  limitations: ['Catalog alternate-image queries are same-product proxies, not independent customer photos', 'No human-rated similarity or absent-product evaluation', 'Timing includes gateway network and local ranking but excludes user upload, production database, auth, and signed URLs', 'Input type is omitted for both gallery/query; this gateway baseline does not compare document/query-specific prompting'] };
await fs.writeFile(path.join(resultDir, 'results.json'), JSON.stringify({ summary, queries }, null, 2));
await fs.writeFile(path.join(resultDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
