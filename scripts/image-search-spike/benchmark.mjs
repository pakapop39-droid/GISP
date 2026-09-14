// Local CPU retrieval benchmark. No image is sent to an AI provider.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '../../output/image-search-spike/runtime/node_modules/@huggingface/transformers/src/transformers.js';

const root = path.resolve('output/image-search-spike');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  for (let attempt = 0; ; attempt++) {
    try { return await originalFetch(...args); }
    catch (error) {
      if (attempt >= 2) throw error;
      console.log(`Retrying model download connection (${attempt + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
const modelId = process.argv[2] ?? 'Xenova/clip-vit-base-patch32';
if (!['Xenova/clip-vit-base-patch32', 'Xenova/clip-vit-base-patch16'].includes(modelId)) throw new Error('Unsupported experiment model');
const slug = modelId.split('/')[1];
const resultDir = path.join(root, slug);
await fs.mkdir(resultDir, { recursive: true });
env.cacheDir = path.join(root, 'models');
env.backends.onnx.wasm.numThreads = 4;
const metadataResponse = await fetch(`https://huggingface.co/api/models/${modelId}`);
if (!metadataResponse.ok) throw new Error(`Model metadata HTTP ${metadataResponse.status}`);
const modelMetadata = await metadataResponse.json();
const revision = modelMetadata.sha;
const started = performance.now();
const reported = new Set();
const progress = info => {
  const step = Math.floor((info.progress ?? 0) / 25) * 25;
  const key = `${info.file}:${step}`;
  if (info.status === 'progress' && !reported.has(key)) { reported.add(key); console.log(`Model download ${info.file}: ${step}%`); }
};
const processor = await AutoProcessor.from_pretrained(modelId, { revision });
const model = await CLIPVisionModelWithProjection.from_pretrained(modelId, {
  revision, dtype: 'q8', device: 'cpu', progress_callback: progress,
  session_options: { intraOpNumThreads: 4, interOpNumThreads: 1 },
});
const loadMs = performance.now() - started;
console.log(`Loaded ${modelId} at ${revision}, ${Math.round(loadMs)} ms`);
const dataset = JSON.parse(await fs.readFile(path.join(root, 'dataset.json'), 'utf8'));
const cachePath = path.join(resultDir, 'embeddings.json');
const identity = `${revision}:q8:processor-default:normalized-768-jpeg88-v1`;
let cache = { identity, vectors: {} };
try { const old = JSON.parse(await fs.readFile(cachePath, 'utf8')); if (old.identity === identity) cache = old; } catch {}
const durations = [];
async function embed(relative, bypassCache = false) {
  const bytes = await fs.readFile(path.join(root, relative));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (!bypassCache && cache.vectors[hash]) return cache.vectors[hash];
  const begin = performance.now();
  const input = await processor(await RawImage.read(path.join(root, relative)));
  const { image_embeds } = await model(input);
  const vector = Array.from(image_embeds.data);
  const norm = Math.sqrt(vector.reduce((n, v) => n + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0 || vector.length !== 512) throw new Error('Invalid embedding');
  const normalized = vector.map(v => v / norm);
  durations.push(performance.now() - begin);
  if (!bypassCache) cache.vectors[hash] = normalized;
  return normalized;
}
const galleryVectors = [];
for (let i = 0; i < dataset.gallery.length; i++) {
  galleryVectors.push(await embed(dataset.gallery[i].image.relative));
  if ((i + 1) % 50 === 0) {
    await fs.writeFile(cachePath, JSON.stringify(cache));
    console.log(`Embedded gallery ${i + 1}/${dataset.gallery.length}`);
  }
}
function rank(vector, excludedIds = new Set()) {
  return dataset.gallery.map((p, i) => ({ productId: p.id, sku: p.sku, name: p.name, category: p.category, relative: p.image.relative,
    score: galleryVectors[i].reduce((n, v, j) => n + v * vector[j], 0),
  })).filter(p => !excludedIds.has(p.productId)).sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
}
const queryResults = [];
for (const query of dataset.queries) {
  const vector = await embed(query.relative);
  const ranked = rank(vector);
  const expectedRank = ranked.findIndex(p => query.expectedProductIds.includes(p.productId)) + 1;
  const expectedCategory = dataset.gallery.find(p => p.id === query.productId).category;
  const categoryRanked = ranked.filter(p => p.category === expectedCategory);
  const expectedCategoryRank = categoryRanked.findIndex(p => query.expectedProductIds.includes(p.productId)) + 1;
  const bytes = await fs.readFile(path.join(root, query.relative));
  const hash = createHash('sha256').update(bytes).digest('hex');
  const leakageProductIds = dataset.gallery.filter(p => p.image.normalizedSha256 === hash).map(p => p.id);
  queryResults.push({ ...query, expectedRank, expectedCategoryRank, top1Score: ranked[0]?.score, expectedScore: ranked[expectedRank - 1]?.score,
    leakageProductIds, top10: ranked.slice(0, 10) });
}
await fs.writeFile(cachePath, JSON.stringify(cache));
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const metrics = [];
for (const split of ['calibration', 'holdout']) for (const kind of ['compressed', 'alternate-proxy']) {
  const qs = queryResults.filter(q => q.split === split && q.kind === kind);
  const clean = qs.filter(q => !q.leakageProductIds.length);
  const measure = list => ({ total: list.length, hit1: list.filter(q => q.expectedRank === 1).length,
    hit5: list.filter(q => q.expectedRank > 0 && q.expectedRank <= 5).length,
    hit10: list.filter(q => q.expectedRank > 0 && q.expectedRank <= 10).length,
    categoryFilterHit10: list.filter(q => q.expectedCategoryRank > 0 && q.expectedCategoryRank <= 10).length });
  metrics.push({ split, kind, ...measure(qs), withoutByteLeakage: measure(clean) });
}
// Separate warm timing from the batch; do not report this as hosted p95.
const warmTimes = [];
for (const q of dataset.queries.slice(0, 20)) {
  const t = performance.now(); rank(await embed(q.relative, true)); warmTimes.push(performance.now() - t);
}
const concurrentBegin = performance.now();
await Promise.all(dataset.queries.slice(0, 5).map(async q => rank(await embed(q.relative, true))));
const concurrentFiveMs = performance.now() - concurrentBegin;
const summary = {
  runAt: new Date().toISOString(), modelId, revision, dtype: 'q8', dimension: 512,
  runtime: '@huggingface/transformers 3.8.1 / ONNX CPU', cpu: os.cpus()[0].model,
  logicalCores: os.cpus().length, ramGiB: os.totalmem() / 2 ** 30,
  modelLoadIncludingDownloadMs: loadMs, galleryProducts: dataset.gallery.length,
  queryCount: queryResults.length, metrics,
  freshEmbeddingCount: durations.length,
  warmLocalQueryMs: { n: warmTimes.length, median: percentile(warmTimes, .5), p95: percentile(warmTimes, .95) },
  concurrentFiveLocalCompletionMs: concurrentFiveMs,
  threshold: null, absentProductEvaluation: 'NOT_RUN_NO_HUMAN_LABELS',
  similarProductEvaluation: 'NOT_RUN_NO_HUMAN_LABELS',
  limitations: ['Alternate-image results measure same-product retrieval only, not human-rated similarity', 'No calibrated rejection threshold; top10 results are diagnostic rankings', 'Timing excludes upload, remote AI, database, authentication and signed URLs', 'Gallery contains one image per product; exact/near duplicates can inflate results', 'Category-filter analysis is exploratory and assumes the user supplies the correct category; it is not automatic category recognition'],
};
await fs.writeFile(path.join(resultDir, 'results.json'), JSON.stringify({ summary, queries: queryResults }, null, 2));
await fs.writeFile(path.join(resultDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await model.dispose();
