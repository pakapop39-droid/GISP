import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('output/image-search-spike');
const read = async name => JSON.parse((await fs.readFile(path.join(root, name), 'utf8')).replace(/^\uFEFF/, ''));
const dataset = await read('dataset.json');
const inventory = await read('inventory.json');
const ids = new Set(inventory.rows.map(r => r.product_id));
assert.equal(dataset.summary.eligibleProducts, ids.size);
assert.equal(dataset.summary.eligibleImageRecords, inventory.rows.length);
assert.equal(new Set(dataset.gallery.map(p => p.id)).size, dataset.gallery.length);
assert.equal(dataset.gallery.length + dataset.products.filter(p => !p.images.length).length, ids.size);
const splits = new Map();
for (const q of dataset.queries) {
  assert(!splits.has(q.productId) || splits.get(q.productId) === q.split, 'One product must not cross calibration/holdout');
  splits.set(q.productId, q.split);
  assert(ids.has(q.productId));
  assert.equal(q.expectedProductIds.length, 1);
  const p = dataset.gallery.find(p => p.id === q.productId);
  if (q.kind === 'alternate-proxy') assert.notEqual(q.relative, p.image.relative, 'Alternate query must not be its indexed file');
  await fs.access(path.join(root, q.relative));
}
const validatedModels = [];
for (const slug of ['clip-vit-base-patch32', 'clip-vit-base-patch16', 'voyage-multimodal-3.5']) {
  let result;
  try { result = await read(`${slug}/results.json`); } catch { continue; }
  assert.equal(result.summary.galleryProducts, ids.size, 'A missing gallery image invalidates whole-catalog claim');
  assert.equal(result.queries.length, dataset.queries.length);
  assert.equal(result.summary.threshold, null, 'No uncalibrated rejection threshold may be reported');
  assert((result.summary.hostedQueryMs ?? result.summary.warmLocalQueryMs).p95 > 0);
  const vectors = await read(`${slug}/embeddings.json`);
  for (const vector of Object.values(vectors.vectors)) {
    assert.equal(vector.length, result.summary.dimension);
    assert(vector.every(Number.isFinite));
    assert(Math.abs(Math.hypot(...vector) - 1) < .00001);
  }
  for (const q of result.queries) {
    assert.equal(new Set(q.top10.map(p => p.productId)).size, 10);
    for (let i = 1; i < q.top10.length; i++) assert(q.top10[i - 1].score >= q.top10[i].score);
    if (q.expectedRank <= 10) assert(q.expectedProductIds.includes(q.top10[q.expectedRank - 1].productId));
    for (const p of q.top10) await fs.access(path.join(root, p.relative));
  }
  validatedModels.push(slug);
}
assert(validatedModels.includes('clip-vit-base-patch32') && validatedModels.includes('clip-vit-base-patch16'), 'Both local baselines must complete');
if (process.argv.includes('--require-hosted')) assert(validatedModels.includes('voyage-multimodal-3.5'), 'Hosted comparison must complete');
const costs = await read('costs.json');
assert.equal(costs.providerBenchmarkRun, validatedModels.includes('voyage-multimodal-3.5'));
if (costs.providerBenchmarkRun) {
  const ledger = await read('voyage-multimodal-3.5/ledger.json');
  const successful = ledger.requests.filter(r => r.status === 'ok');
  assert(successful.every(r => r.policy.data_collection === 'deny' && r.policy.only.join(',') === 'voyageai'));
  assert(ledger.conservativeReservedUsd <= ledger.budgetUsd);
  assert.equal(ledger.missingCostResponses, 0);
  assert(Math.abs(successful.reduce((n, r) => n + r.usage.cost, 0) - costs.hostedExperiment.reportedCostUsd) < 1e-9);
}
assert(Math.abs(costs.catalogFull3568UpperUsd - inventory.rows.length * 768 * 768 * .6 / 1e9) < 1e-9);
const report = await fs.readFile(path.join(root, 'review.html'), 'utf8');
assert(!/api_key|object_key|factory_cost|signedUrl/.test(report), 'Review must not embed private storage keys or credentials');
console.log(JSON.stringify({ status: 'PASS', galleryProducts: ids.size, queryCount: dataset.queries.length, distinctQueryProducts: splits.size, models: validatedModels,
  checks: ['inventory reconciliation', 'disjoint product splits', 'alternate image exclusion', 'unit-norm finite vectors', 'unique correctly ordered results', 'local asset existence', 'no fabricated threshold or provider test', 'cost arithmetic', 'review payload allowlist'] }, null, 2));
