const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const discoveryRouter = require('./routes/discovery');
const sessionRouter = require('./routes/session');
const mountRouter = require('./routes/mount');
const configRouter = require('./routes/config');
const reconnectService = require('./services/reconnect');

const APPDEST = process.env.TRIM_APPDEST || path.resolve(__dirname);
const PKGETC = process.env.TRIM_PKGETC || path.join(__dirname, 'etc');
const SOCKET_PATH = path.join(APPDEST, 'iscsi.sock');
const PREFIX = '/app/fnnas-iscsi';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const app = express();

app.use(express.json());

function adminOnly(req, res, next) {
  if (process.env.NODE_ENV === 'development') return next();
  const isAdmin = req.headers['x-trim-isadmin'];
  if (isAdmin !== '1' && isAdmin !== 'true') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

app.use(`${PREFIX}/api`, adminOnly);

app.use(`${PREFIX}/api`, discoveryRouter);
app.use(`${PREFIX}/api`, sessionRouter);
app.use(`${PREFIX}/api`, mountRouter);
app.use(`${PREFIX}/api`, configRouter);

const staticDir = path.join(APPDEST, 'public');
if (fs.existsSync(staticDir)) {
  app.use(PREFIX, express.static(staticDir));
  app.get(`${PREFIX}/*`, (req, res) => {
    if (req.path.startsWith(`${PREFIX}/api`)) return res.status(404).end();
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

fs.mkdirSync(PKGETC, { recursive: true });

try {
  if (fs.existsSync(SOCKET_PATH)) {
    fs.unlinkSync(SOCKET_PATH);
  }
} catch (err) {
  console.error('Failed to remove old socket:', err.message);
}

const server = http.createServer(app);

server.listen(SOCKET_PATH, () => {
  try {
    fs.chmodSync(SOCKET_PATH, 0o777);
  } catch (err) {
    console.error('Failed to chmod socket:', err.message);
  }
  console.log(`iSCSI backend listening on ${SOCKET_PATH}`);

  reconnectService.autoReconnect(PKGETC).catch((err) => {
    console.error('Auto-reconnect failed:', err.message);
  });
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    try {
      if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
