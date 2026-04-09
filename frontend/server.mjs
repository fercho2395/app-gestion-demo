import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(indexFile)) {
  console.error('Missing dist/index.html. Run npm run build before npm run start.');
  process.exit(1);
}

function renderEnvScript() {
  const config = {
    VITE_API_URL: process.env.VITE_API_URL || '',
    VITE_AZURE_TENANT_ID: process.env.VITE_AZURE_TENANT_ID || '',
    VITE_AZURE_CLIENT_ID: process.env.VITE_AZURE_CLIENT_ID || '',
    VITE_AZURE_REDIRECT_URI: process.env.VITE_AZURE_REDIRECT_URI || '',
  };

  return `window.__APP_CONFIG__ = ${JSON.stringify(config)};`;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/env.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(renderEnvScript());
    return;
  }

  const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
  const relativePath = requestedPath.replace(/^\/+/, '');

  let filePath = path.normalize(path.join(distDir, relativePath));
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // SPA fallback: unknown routes should load index.html.
  if (!existsSync(filePath) || filePath.endsWith(path.sep)) {
    filePath = indexFile;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    res.writeHead(404);
    res.end('Not found');
  });
  stream.pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Frontend serving on 0.0.0.0:${port}`);
});
