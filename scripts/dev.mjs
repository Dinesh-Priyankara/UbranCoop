import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { onRequest } from '../functions/api/portal.js';
// Development serves the real Pages handler. Environment variables stay server-side.
try { process.loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const root = resolve('dist');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    if (url.pathname === '/api/portal') {
      let body = '', length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 100000) { res.writeHead(413).end(); return; } body += chunk; }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' ? { body } : {}) });
      const response = await onRequest({ request, env: process.env });
      const headers = Object.fromEntries(response.headers);
      headers['set-cookie'] = response.headers.getSetCookie();
      res.writeHead(response.status, headers).end(await response.text()); return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store' }).end(content);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('UrbanCoop local preview: http://127.0.0.1:4173'));
