// Read-only catalog download and reproducible local evaluation preparation.
// Private paths, image bytes and results remain in gitignored output/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@insforge/sdk';
import sharp from '../../output/image-search-spike/runtime/node_modules/sharp/lib/index.js';

const root = path.resolve('output/image-search-spike');
const config = JSON.parse(await fs.readFile('.insforge/project.json', 'utf8'));
if (config.appkey !== 'kit6y4pj' || config.project_name !== 'gisp-mvp-development') {
  throw new Error('This read-only experiment is restricted to gisp-mvp-development.');
}
const admin = createAdminClient({ baseUrl: config.oss_host, apiKey: config.api_key });
const raw = JSON.parse((await fs.readFile(path.join(root, 'inventory.json'), 'utf8')).replace(/^\uFEFF/, ''));
const rows = raw.rows;
if (!Array.isArray(rows) || !rows.length) throw new Error('Inventory has no rows');
await fs.mkdir(path.join(root, 'images'), { recursive: true });
await fs.mkdir(path.join(root, 'queries'), { recursive: true });
const byProduct = new Map();
for (const row of rows) {
  const product = byProduct.get(row.product_id) ?? { id: row.product_id, sku: row.sku, name: row.name_th, category: row.category ?? 'Uncategorized', media: [] };
  product.media.push(row);
  byProduct.set(product.id, product);
}
const products = [...byProduct.values()];
const categories = new Map();
for (const p of products) {
  const list = categories.get(p.category) ?? [];
  list.push(p); categories.set(p.category, list);
}
// Round-robin categories, stable SKU ordering; selected before seeing scores.
const sample = [];
for (let round = 0; sample.length < Math.min(50, products.length); round++) {
  for (const list of categories.values()) {
    if (list[round] && sample.length < 50) sample.push(list[round]);
  }
}
const sampleIds = new Set(sample.map(p => p.id));
const failures = [];
async function download(row) {
  if (!row.file_id) throw new Error('MISSING_FILE_METADATA');
  const relative = `images/${row.media_id}.jpg`;
  const filename = path.join(root, relative);
  const metaFilename = `${filename}.json`;
  try { return JSON.parse(await fs.readFile(metaFilename, 'utf8')); } catch {}
  const result = await admin.storage.from(row.bucket).download(row.object_key);
  if (result.error || !result.data) throw new Error('STORAGE_DOWNLOAD_FAILED');
  const bytes = Buffer.from(await result.data.arrayBuffer());
  const source = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' });
  const meta = await source.metadata();
  await source.rotate().resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).jpeg({ quality: 88 }).toFile(filename);
  const normalized = await fs.readFile(filename);
  const record = {
    mediaId: row.media_id, fileId: row.file_id, relative,
    width: meta.width, height: meta.height, format: meta.format,
    bytes: bytes.length, metadataBytes: Number(row.size_bytes),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    normalizedSha256: createHash('sha256').update(normalized).digest('hex'),
  };
  await fs.writeFile(metaFilename, JSON.stringify(record, null, 2));
  return record;
}
let cursor = 0, completed = 0;
const processed = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < products.length) {
    const p = products[cursor++];
    const images = [];
    const limit = sampleIds.has(p.id) ? 3 : 1;
    for (const row of p.media.slice(0, limit)) {
      try { images.push(await download(row)); }
      catch (error) { failures.push({ productId: p.id, mediaId: row.media_id, reason: error.message }); }
    }
    processed.push({ id: p.id, sku: p.sku, name: p.name, category: p.category, imageCount: p.media.length, images });
    completed++;
    if (completed % 50 === 0) console.log(`Downloaded/checked ${completed}/${products.length} products`);
  }
}));
processed.sort((a, b) => a.sku.localeCompare(b.sku));
const queries = [];
for (let i = 0; i < sample.length; i++) {
  const product = processed.find(p => p.id === sample[i].id);
  if (!product?.images.length) continue;
  const main = product.images[0];
  const split = i % 2 === 0 ? 'calibration' : 'holdout';
  const relative = `queries/${product.id}-compressed.jpg`;
  await sharp(path.join(root, main.relative)).resize({ width: 224, height: 224, fit: 'inside' }).jpeg({ quality: 40 }).toFile(path.join(root, relative));
  queries.push({ id: `${product.id}-compressed`, productId: product.id, kind: 'compressed', split, relative, expectedProductIds: [product.id] });
  const alternate = product.images.slice(1).find(image => image.normalizedSha256 !== main.normalizedSha256 && image.sha256 !== main.sha256);
  if (alternate) queries.push({ id: `${product.id}-alternate`, productId: product.id, kind: 'alternate-proxy', split, relative: alternate.relative, expectedProductIds: [product.id], needsHumanReview: true });
}
// Same item is present only via its first image. Alternate query bytes are never
// deliberately indexed. Cross-product byte duplicates are audited below.
const gallery = processed.filter(p => p.images.length).map(p => ({ ...p, image: p.images[0], images: undefined }));
const hashMap = new Map();
for (const p of gallery) {
  const ids = hashMap.get(p.image.normalizedSha256) ?? [];
  ids.push(p.id); hashMap.set(p.image.normalizedSha256, ids);
}
const duplicateGalleryGroups = [...hashMap.values()].filter(ids => ids.length > 1);
const summary = {
  inspectedAt: new Date().toISOString(), project: config.project_name,
  eligibleProducts: products.length, eligibleImageRecords: rows.length,
  imageMetadataBytes: rows.reduce((n, r) => n + Number(r.size_bytes ?? 0), 0),
  categories: [...categories].map(([name, list]) => ({ name, products: list.length })),
  sampleProducts: sample.length, galleryProducts: gallery.length,
  downloadedImages: processed.reduce((n, p) => n + p.images.length, 0),
  smallImages: processed.flatMap(p => p.images).filter(i => Math.min(i.width, i.height) < 224).length,
  failures, duplicateGalleryGroups,
  queryCounts: Object.fromEntries([...new Set(queries.map(q => q.kind))].map(kind => [kind, queries.filter(q => q.kind === kind).length])),
  limits: ['Gallery uses one image per eligible product', 'Alternate catalog images are proxies, not verified customer photographs', 'No human relevance labels or verified absent-product negatives yet', 'Only selected image files decoded; metadata coverage is not full-file quality coverage'],
};
await fs.writeFile(path.join(root, 'dataset.json'), JSON.stringify({ summary, products: processed, gallery, queries }, null, 2));
await fs.writeFile(path.join(root, 'inventory-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
