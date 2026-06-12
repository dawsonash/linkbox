import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4321);

// Milestone 1 replaces this stub with real routes backed by a LinkStore.
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not implemented yet' }));
});

server.listen(PORT, () => {
  console.log(`linkbox api listening on http://localhost:${PORT}`);
});
