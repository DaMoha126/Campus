const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const port = Number(process.env.PORT || 3030);
const dataDir = process.env.ETUDIA_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'etudia.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON invalide')); } });
  });
}
function required(value, field) { if (!value || !String(value).trim()) throw new Error(`${field} est requis`); return String(value).trim(); }
function match(url, pattern) { return url.pathname.match(pattern); }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok', service: 'etudia-api', database: 'ready' });
    if (req.method === 'GET' && url.pathname === '/api/establishments') {
      return json(res, 200, db.prepare('SELECT * FROM establishments ORDER BY name').all());
    }
    if (req.method === 'POST' && url.pathname === '/api/establishments') {
      const body = await readJson(req);
      const result = db.prepare('INSERT INTO establishments (name, country, city) VALUES (?, ?, ?)').run(required(body.name, 'name'), required(body.country, 'country'), body.city || null);
      return json(res, 201, db.prepare('SELECT * FROM establishments WHERE id = ?').get(result.lastInsertRowid));
    }
    let found = match(url, /^\/api\/establishments\/(\d+)\/dashboard$/);
    if (req.method === 'GET' && found) {
      const id = Number(found[1]);
      const count = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE establishment_id = ?`).get(id).count;
      return json(res, 200, { establishmentId: id, students: count('people') ? db.prepare("SELECT COUNT(*) AS count FROM people WHERE establishment_id = ? AND role = 'student'").get(id).count : 0, teachers: db.prepare("SELECT COUNT(*) AS count FROM people WHERE establishment_id = ? AND role = 'teacher'").get(id).count, classes: count('classes'), subjects: count('subjects') });
    }
    found = match(url, /^\/api\/establishments\/(\d+)\/(classes|subjects|people)$/);
    if (found) {
      const id = Number(found[1]), resource = found[2];
      if (req.method === 'GET') return json(res, 200, db.prepare(`SELECT * FROM ${resource} WHERE establishment_id = ? ORDER BY id DESC`).all(id));
      if (req.method === 'POST') {
        const body = await readJson(req);
        if (resource === 'subjects') db.prepare('INSERT INTO subjects (establishment_id, name) VALUES (?, ?)').run(id, required(body.name, 'name'));
        if (resource === 'people') db.prepare('INSERT INTO people (establishment_id, role, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)').run(id, required(body.role, 'role'), required(body.firstName, 'firstName'), required(body.lastName, 'lastName'), body.email || null, body.phone || null);
        if (resource === 'classes') db.prepare('INSERT INTO classes (establishment_id, academic_year_id, name, capacity) VALUES (?, ?, ?, ?)').run(id, Number(body.academicYearId), required(body.name, 'name'), body.capacity || null);
        return json(res, 201, { created: true, resource });
      }
    }
    return json(res, 404, { error: 'Route inconnue' });
  } catch (error) { return json(res, 400, { error: error.message }); }
});
server.listen(port, () => console.log(`Étudia API disponible sur http://localhost:${port}`));
