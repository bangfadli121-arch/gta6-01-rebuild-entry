// EMBER BAY — Heat Line. Round 5, written from zero.
// Static file server for the game/ directory (kit level 38 entrypoint).
// Usage: deno run --allow-net --allow-read main.ts   (or: node --experimental-strip-types main.ts)
import { serveDir } from "jsr:@std/http/file-server";

const PORT = 8080;
const ROOT = new URL("./game/", import.meta.url).pathname;

console.log(`EMBER BAY — Heat Line serving ${ROOT} on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, (req) => serveDir(req, { fsRoot: ROOT, showDirListing: false }));
