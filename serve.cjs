// Minimal local static server for TUNAV DIGITAL VOICE: node serve.cjs [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = Number(process.argv[2] || 5220);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(root, p === '/' ? 'index.html' : p));
  if (!file.startsWith(root) || /[\\/](supabase|serve\.cjs)/.test(file.slice(root.length))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`TUNAV Digital Voice: http://localhost:${port}  (admin: /admin.html)`));
