// EMBER BAY — make.fun gta6-01 entry program (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from the kit's vendor/makefun-game.ts.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// buildDossier returns the dossier as canonical JSON *bytes*
// (Uint8Array); write those bytes directly, never JSON.stringify them.
const dossierBytes = buildDossier(outDir, {
  // gate caps from the competition spec: dossier.json at most 1.5 MiB,
  // 3-4 screenshots at most 256 KiB each, game/ at most 993 entries and
  // 48 MiB. text_max_bytes 400,000 covers all of this entry's source
  // (~79 KiB) while keeping the dossier under the 1.5 MiB cap.
  text_max_bytes: 400000,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
console.log('EMBER BAY handed in to ' + outDir);
