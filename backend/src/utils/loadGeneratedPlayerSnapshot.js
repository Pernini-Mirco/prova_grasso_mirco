import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedFile = path.resolve(__dirname, '../data/generatedPlayerSnapshot.json');

export function getGeneratedPlayerSnapshot() {
  if (!fs.existsSync(generatedFile)) {
    return { players: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(generatedFile, 'utf-8'));
  } catch {
    return { players: [] };
  }
}
