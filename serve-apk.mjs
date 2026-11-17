import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const server = http.createServer((req, res) => {
  const filePath = path.resolve('DojoManager.apk');
  if (req.url === '/DojoManager.apk' || req.url === '/' || req.url === '/download') {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="DojoManager.apk"',
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found');
});

server.listen(8000, '0.0.0.0', () => {
  console.log('APK server running on http://0.0.0.0:8000/DojoManager.apk');
});
