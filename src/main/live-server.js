// src/main/live-server.js
const http = require('http');
const path = require('path');
const fs = require('fs');

/**
 * LiveServer - Un servidor HTTP minimalista para previsualizar HTML
 */
class LiveServer {
  constructor() {
    this.server = null;
    this.port = 5500;
    this.root = '';
  }

  async start(rootPath, preferredPort = 5500) {
    if (this.server) {
      await this.stop();
    }

    this.root = path.resolve(rootPath);
    this.port = preferredPort;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);
        let decodedPath = decodeURIComponent(parsedUrl.pathname);
        if (decodedPath === '/') decodedPath = '/index.html';

        // Asegurar que la ruta no se salga del root (seguridad básica)
        const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(this.root, safePath);
        
        console.log(`[LiveServer] Petición: ${req.url} -> ${filePath}`);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.wav': 'audio/wav',
          '.mp4': 'video/mp4',
          '.woff': 'application/font-woff',
          '.ttf': 'application/font-ttf',
          '.eot': 'application/vnd.ms-fontobject',
          '.otf': 'application/font-otf',
          '.wasm': 'application/wasm'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
          if (error) {
            if (error.code === 'ENOENT') {
              res.writeHead(404);
              res.end('404 - Archivo no encontrado');
            } else {
              res.writeHead(500);
              res.end('500 - Error de servidor: ' + error.code);
            }
          } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
          }
        });
      });

      this.server.listen(this.port, () => {
        console.log(`Live Server corriendo en http://localhost:${this.port}`);
        resolve({ port: this.port, url: `http://localhost:${this.port}` });
      });

      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          console.log(`Puerto ${this.port} en uso, reintentando con ${this.port + 1}...`);
          this.port++;
          this.server.close();
          this.start(rootPath, this.port).then(resolve).catch(reject);
        } else {
          reject(e);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new LiveServer();
