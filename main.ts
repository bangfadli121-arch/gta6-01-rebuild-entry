// main.ts — entrypoint for the make.fun grader (kit level 38 requires
// main.ts or main.py at root). Serves the game/ directory on :8080.
const GAME_DIR = new URL("./game", import.meta.url).pathname;
const PORT = 8080;

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  // the game loads Kenney GLB models — serve them with their real type
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/index.html";
  const file = `${GAME_DIR}${path}`;
  if (!file.startsWith(GAME_DIR)) return new Response("not found", { status: 404 });
  try {
    const data = await Deno.readFile(file);
    const ext = path.slice(path.lastIndexOf("."));
    return new Response(data, { headers: { "content-type": MIME[ext] || "application/octet-stream" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
});

console.log(`EMBER BAY — Heat Line serving on http://localhost:${PORT}`);
