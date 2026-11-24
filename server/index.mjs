import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoomHub } from './roomHub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

const hub = createRoomHub();

const server = createServer(async (req, res) => {
  try {
    if (hub.handleInvitation(req, res)) return;
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (reqUrl.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, activeRooms: hub.rooms.size }));
      return;
    }

    const decodedPath = decodeURIComponent(reqUrl.pathname);
    const safeRelative = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let candidate = path.resolve(DIST_DIR, `.${safeRelative}`);

    if (!candidate.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let fileStat = await stat(candidate).catch(() => null);
    if (fileStat && fileStat.isDirectory()) {
      candidate = path.join(candidate, 'index.html');
      fileStat = await stat(candidate).catch(() => null);
    }

    if (!fileStat || !fileStat.isFile()) {
      // SPA fallback for direct links including ?room=XXXXXX
      candidate = path.join(DIST_DIR, 'index.html');
      fileStat = await stat(candidate).catch(() => null);
      if (!fileStat) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Build artifacts not found. Run npm run build first.');
        return;
      }
    }

    const ext = path.extname(candidate).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutableAsset = candidate.includes(`${path.sep}assets${path.sep}`);
    const body = await readFile(candidate);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isImmutableAsset
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

hub.attachToServer(server);

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `Loy Krathong Couple Online Server listening on http://${HOST}:${PORT}\n`
  );
});
