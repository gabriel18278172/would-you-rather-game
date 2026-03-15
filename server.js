/* ==============================================
   Would You Rather — server.js
   Zero-dependency Node.js server.
   Built 100% from scratch using only built-in modules.
   ============================================== */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ===== CONFIG =====

const PORT       = process.env.PORT || 3000;
const DATA_DIR   = path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

// ===== MIME TYPES =====

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
};

// ===== STORAGE =====

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VOTES_FILE)) {
    fs.writeFileSync(VOTES_FILE, '{}', 'utf8');
  }
}

function readVotes() {
  try {
    const raw = fs.readFileSync(VOTES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeVotes(data) {
  // Atomic write: write to a temp file then rename to avoid corruption
  const tmp = VOTES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, VOTES_FILE);
}

// ===== CORS HEADERS =====

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ===== JSON RESPONSE HELPERS =====

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

// ===== KEY HELPER =====

function toVoteKey(questionIndex) {
  return String(Number(questionIndex));
}

// ===== BODY PARSER =====

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ===== STATIC FILE SERVER =====

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendError(res, 404, 'Not Found');
      } else {
        sendError(res, 500, 'Internal Server Error');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

// ===== API ROUTES =====

// POST /api/vote
// Body: { "questionIndex": 0, "choice": "A" }
// Returns: { "a": 1234, "b": 567 }
async function handleVote(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body');
    return;
  }

  const { questionIndex, choice } = body;

  if (!Number.isInteger(Number(questionIndex))) {
    sendError(res, 400, 'questionIndex must be an integer');
    return;
  }
  if (choice !== 'A' && choice !== 'B') {
    sendError(res, 400, 'choice must be "A" or "B"');
    return;
  }

  const key = toVoteKey(questionIndex);
  const votes = readVotes();

  if (!votes[key]) {
    votes[key] = { a: 0, b: 0 };
  }

  if (choice === 'A') {
    votes[key].a += 1;
  } else {
    votes[key].b += 1;
  }

  writeVotes(votes);

  sendJson(res, 200, { a: votes[key].a, b: votes[key].b });
}

// GET /api/votes/:questionIndex
// Returns: { "a": 1234, "b": 567 }
function handleGetVotes(req, res, questionIndex) {
  const key = toVoteKey(questionIndex);
  const votes = readVotes();
  const entry = votes[key] || { a: 0, b: 0 };
  sendJson(res, 200, { a: entry.a, b: entry.b });
}

// ===== REQUEST ROUTER =====

function handleRequest(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed   = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  // API: POST /api/vote
  if (req.method === 'POST' && pathname === '/api/vote') {
    handleVote(req, res).catch(e => sendError(res, 500, e.message));
    return;
  }

  // API: GET /api/votes/:questionIndex
  const votesMatch = pathname.match(/^\/api\/votes\/(\d+)$/);
  if (req.method === 'GET' && votesMatch) {
    handleGetVotes(req, res, votesMatch[1]);
    return;
  }

  // Static files — only allow GET/HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  // Resolve the file path — prevent path traversal
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    // Normalise and restrict to project root
    const relative = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    filePath = path.join(__dirname, relative);
  }

  // Security: ensure the resolved path stays within the project directory
  const projectRoot = path.resolve(__dirname);
  const resolved    = path.resolve(filePath);
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  serveStatic(req, res, filePath);
}

// ===== STARTUP =====

ensureDataDir();

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Would You Rather server running at http://localhost:${PORT}`);
  console.log(`Votes stored in: ${VOTES_FILE}`);
  console.log('Press Ctrl+C to stop.');
});
