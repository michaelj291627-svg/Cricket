/*
 * WPL-2026 static + API server.
 * Serves the site on all network interfaces and stores registrations in teams.json
 * so every device on the network shares the same data.
 *
 * Usage: node server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'teams.json');
const MAX_PLAYERS = 6;
const MAX_BODY_BYTES = 16 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function readTeams() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTeams(teams) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2), 'utf8');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function normalize(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, 40);
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,39}$/;

/* Server-side validation: the browser form is not the only possible client. */
function validateTeam(payload, teams, exceptId) {
  const teamName = normalize(payload && payload.teamName);
  const captainName = normalize(payload && payload.captainName);
  const rawPlayers = Array.isArray(payload && payload.players) ? payload.players : [];
  const players = rawPlayers.slice(0, MAX_PLAYERS).map(normalize);

  if (teamName.length < 3) return { error: 'Team name must be at least 3 characters.' };
  if (!NAME_PATTERN.test(captainName)) return { error: 'Captain name is invalid.' };
  if (players.length !== MAX_PLAYERS || players.some(p => !NAME_PATTERN.test(p))) {
    return { error: 'Exactly ' + MAX_PLAYERS + ' valid player names are required.' };
  }

  const key = v => v.toLowerCase();
  if (new Set(players.map(key)).size !== players.length) {
    return { error: 'Player names must be unique within the team.' };
  }
  if (teams.some(t => t.id !== exceptId && key(t.teamName) === key(teamName))) {
    return { error: 'This team name is already registered.' };
  }

  const used = new Map();
  teams.filter(t => t.id !== exceptId).forEach(t => (t.players || []).forEach(p => used.set(key(p), t.teamName)));
  const clash = players.find(p => used.has(key(p)));
  if (clash) return { error: '"' + clash + '" is already registered with team ' + used.get(key(clash)) + '.' };

  return { team: { teamName, captainName, players } };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  const idMatch = pathname.match(/^\/api\/teams\/([A-Za-z0-9]+)$/);

  if (pathname === '/api/teams' && req.method === 'GET') {
    return sendJson(res, 200, readTeams());
  }

  if (pathname === '/api/teams' && req.method === 'POST') {
    const payload = await readBody(req);
    const teams = readTeams();
    const result = validateTeam(payload, teams, null);
    if (result.error) return sendJson(res, 400, { error: result.error });
    const team = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      ...result.team,
      registeredOn: new Date().toISOString()
    };
    teams.push(team);
    writeTeams(teams);
    return sendJson(res, 201, team);
  }

  if (idMatch && req.method === 'PUT') {
    const id = idMatch[1];
    const payload = await readBody(req);
    const teams = readTeams();
    const index = teams.findIndex(t => t.id === id);
    if (index === -1) return sendJson(res, 404, { error: 'Team not found.' });
    const result = validateTeam(payload, teams, id);
    if (result.error) return sendJson(res, 400, { error: result.error });
    teams[index] = { ...teams[index], ...result.team };
    writeTeams(teams);
    return sendJson(res, 200, teams[index]);
  }

  if (idMatch && req.method === 'DELETE') {
    const id = idMatch[1];
    const teams = readTeams();
    const remaining = teams.filter(t => t.id !== id);
    if (remaining.length === teams.length) return sendJson(res, 404, { error: 'Team not found.' });
    writeTeams(remaining);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/teams' && req.method === 'DELETE') {
    writeTeams([]);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);

  // Block path traversal outside the site folder and hide the raw data file.
  if (!filePath.startsWith(ROOT + path.sep) || path.basename(filePath) === 'teams.json') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(err => sendJson(res, 400, { error: err.message }));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method not allowed');
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  console.log('WPL-2026 site is running.');
  console.log('  Local:        http://localhost:' + PORT + '/');
  addresses.forEach(ip => console.log('  Network:      http://' + ip + ':' + PORT + '/'));
  console.log('  Admin page:   http://' + (addresses[0] || 'localhost') + ':' + PORT + '/admin.html');
  console.log('Press Ctrl+C to stop.');
});
