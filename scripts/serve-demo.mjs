import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};
createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
    );
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = await stat(path)
      .then((s) => (s.isFile() ? path : resolve(root, "index.html")))
      .catch(() => (extname(path) ? null : resolve(root, "index.html")));
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(500);
    res.end();
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`DALRO demo: http://127.0.0.1:${port}`),
);
