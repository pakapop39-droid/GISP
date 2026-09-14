import fs from 'node:fs/promises';
import sharp from '../../output/image-search-spike/runtime/node_modules/sharp/lib/index.js';
const root = 'output/image-search-spike';
const dataset = JSON.parse(await fs.readFile(`${root}/dataset.json`));
const result = JSON.parse(await fs.readFile(`${root}/clip-vit-base-patch32/results.json`));
const queries = result.queries.filter(q => q.kind === 'alternate-proxy' && q.split === 'holdout')
  .sort((a, b) => b.expectedRank - a.expectedRank).slice(0, 8);
const layers = [];
for (let i = 0; i < queries.length; i++) {
  const q = queries[i];
  const images = [q.relative, q.top10[0].relative, dataset.gallery.find(p => p.id === q.productId).image.relative];
  for (let j = 0; j < 3; j++) layers.push({
    input: await sharp(`${root}/${images[j]}`).resize(250, 180, { fit: 'contain', background: '#fff' }).toBuffer(),
    left: j * 250, top: i * 205,
  });
  layers.push({ input: Buffer.from(`<svg width="750" height="25"><text x="8" y="18" font-size="13">${i + 1} Query | top result | actual product (rank ${q.expectedRank})</text></svg>`), left: 0, top: i * 205 + 180 });
}
await sharp({ create: { width: 750, height: queries.length * 205, channels: 3, background: '#e8e8e8' } })
  .composite(layers).png().toFile(`${root}/failure-contact.png`);
console.log(queries.map(q => ({ query: q.id, rank: q.expectedRank })));
