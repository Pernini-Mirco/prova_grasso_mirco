import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const verifiedPlayersFile = path.resolve(__dirname, '../data/verifiedActivePlayers.json');

export function getVerifiedActivePlayers() {
  if (!fs.existsSync(verifiedPlayersFile)) {
    return { players: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(verifiedPlayersFile, 'utf-8'));
  } catch {
    return { players: [] };
  }
}
