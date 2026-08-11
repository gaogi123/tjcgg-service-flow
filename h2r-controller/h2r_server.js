const http = require('http');
const { main } = require('./trigger_h2r.js');

const PORT = 4002;

const server = http.createServer(async (req, res) => {
  // Add basic CORS headers just in case
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/sync' || req.url === '/sync-h2r') {
    console.log(`\n[Server] Received sync request from ${req.socket.remoteAddress}`);
    try {
      await main();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: "Sync and push to H2R successful" }));
    } catch (err) {
      console.error(`[Server] Sync failed: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found. Use /sync to trigger the H2R update.');
  }
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` H2R Background Sync Server is running!  `);
  console.log(` Listening on port: ${PORT}`);
  console.log(`=========================================`);
  console.log(`To trigger an update from Companion:`);
  console.log(`1. Add connection "Generic: HTTP Requests"`);
  console.log(`2. Action: "HTTP GET"`);
  console.log(`3. URL: http://localhost:${PORT}/sync`);
  console.log(`=========================================`);
});
