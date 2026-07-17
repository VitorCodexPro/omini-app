
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = path.join('public', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath += '.html';
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(filePath);
  const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
  res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(res);
});

server.listen(3000, () => console.log('Rodando em http://localhost:3000'));
