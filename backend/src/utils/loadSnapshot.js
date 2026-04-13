import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.resolve(__dirname, '../data/nbaData.json');

function getSnapshotGeneratedAt(snapshotMeta, stats) {
  const fileGeneratedAt = stats?.mtime ? new Date(stats.mtime).toISOString() : null;
  const metaGeneratedAt = snapshotMeta?.generatedAt ? new Date(snapshotMeta.generatedAt) : null;

  if (metaGeneratedAt && !Number.isNaN(metaGeneratedAt.getTime())) {
    return metaGeneratedAt.toISOString();
  }

  return fileGeneratedAt;
}

export function getSnapshot() {
  const raw = fs.readFileSync(snapshotPath, 'utf-8');
  const snapshot = JSON.parse(raw);
  const stats = fs.statSync(snapshotPath);

  return {
    ...snapshot,
    meta: {
      ...(snapshot.meta || {}),
      generatedAt: getSnapshotGeneratedAt(snapshot.meta, stats)
    }
  };
}
