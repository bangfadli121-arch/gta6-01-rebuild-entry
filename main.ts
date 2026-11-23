// EMBER BAY — Heat Line: entry program for the make.fun gta6-01 bounty.
// Node 22, standard library only. It copies the playable game in game/ and
// the screenshots in screenshots/ into the output directory, then writes
// /output/dossier.json with the kit's buildDossier library, exactly as the
// competition's gate expects. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output. Run: MAKEFUN_OUTPUT_DIR=out node main.ts
import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyEntryTree(name: string): void {
  const source = join(repoRoot, name);
  const target = join(outputDir, name);
  if (!existsSync(source)) {
    throw new Error(`main.ts: missing ${name}/ in the repository at ${repoRoot}`);
  }
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  copyEntryTree("game");
  copyEntryTree("screenshots");
  const dossier = buildDossier(outputDir, dossierCaps);
  writeFileSync(join(outputDir, "dossier.json"), dossier);
  console.log(`EMBER BAY wrote ${outputDir} (dossier.json ${dossier.length} bytes)`);
}

main();
