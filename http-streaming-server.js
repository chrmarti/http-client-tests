const http = require('http');
const https = require('https');
const http2 = require('http2');
const fs = require('fs');
const path = require('path');
const url = require('url');

const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const HTTP2_PORT = 3444;

// Shared request handler for all protocols
function handleRequest(req, res) {
  const isHttp2 = req.httpVersion === '2.0';

  // Parse query parameters
  const parsedUrl = url.parse(req.url, true);
  const queryChunks = parsedUrl.query.chunks;
  
  const headers = {
    'Content-Type': 'text/plain'
  };

  // Only set Transfer-Encoding for HTTP/1.1
  if (!isHttp2) {
    headers['Transfer-Encoding'] = 'chunked';
  }

  res.writeHead(200, headers);

  const protocol = isHttp2 ? 'HTTP/2' : `HTTP/${req.httpVersion}`;
  const message = `Hello, this is a ${protocol} streaming response! Each character appears with a delay. `;
  let index = 0;
  const n = 1; // Number of characters to send at once
  const totalChunks = queryChunks ? parseInt(queryChunks, 10) || 150000 : 150000;
  let chunksSent = 0;

  const streamChunk = () => {
    if (chunksSent >= totalChunks) {
      res.end();
      return;
    }

    let chunk = '';
    for (let i = 0; i < n; i++) {
      chunk += message[index];
      index = (index + 1) % message.length; // Wrap around to repeat message
    }
    res.write(chunk);
    chunksSent++;

    setImmediate(streamChunk); // Stream as fast as possible
  };

  streamChunk();
}

// HTTP/1.1 server
const httpServer = http.createServer(handleRequest);
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP/1.1 streaming server running on http://localhost:${HTTP_PORT}`);
});

// Try to create TLS servers if certificates are available
try {
  const tlsOptions = {
    key: fs.readFileSync('./server_localhost_key.pem'),
    cert: fs.readFileSync('./server_localhost_crt.pem'),
  };

  // HTTPS/1.1 server
  const httpsServer = https.createServer(tlsOptions, handleRequest);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS/1.1 streaming server running on https://localhost:${HTTPS_PORT}`);
  });

  // HTTP/2 with TLS server
  const http2Server = http2.createSecureServer(tlsOptions, handleRequest);
  http2Server.listen(HTTP2_PORT, () => {
    console.log(`HTTP/2 TLS streaming server running on https://localhost:${HTTP2_PORT}`);
  });

} catch (err) {
  console.log('TLS certificates not found. Only HTTP/1.1 server is running.');
  console.log('To enable HTTPS and HTTP/2, run the following command in this folder:');
  console.log('openssl req -x509 -newkey rsa:4096 -keyout server_localhost_key.pem -out server_localhost_crt.pem -days 365 -nodes -subj /CN=localhost -addext "subjectAltName=DNS:localhost"');
}