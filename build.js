const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const partsDir = path.join(__dirname, 'worker-gzip-v3');
const parts = fs
  .readdirSync(partsDir)
  .filter((file) => file.startsWith('part-') && file.endsWith('.txt'))
  .sort();

if (!parts.length) {
  throw new Error('No worker gzip parts found');
}

const workerGzipBase64 = parts
  .map((file) => fs.readFileSync(path.join(partsDir, file), 'utf8').trim())
  .join('');

const workerSource = zlib
  .gunzipSync(Buffer.from(workerGzipBase64, 'base64'))
  .toString('utf8');

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(path.join('dist', '_worker.js'), workerSource);

console.log(`Built dist/_worker.js from ${parts.length} worker parts`);
