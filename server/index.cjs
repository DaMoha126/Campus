const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const dataDir = process.env.ETUDIA_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'etudia.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
db.exec(`CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY, establishment_id INTEGER NOT NULL REFERENCES establishments(id), person_id INTEGER UNIQUE REFERENCES people(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('administrator','teacher','parent','student')));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);`);
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const required = (v, name) => typeof v === 'string' && v.trim() && v.length <= 200 ? v.trim() : fail(400, `${name} invalide`);
const hash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
function password(v) { if(typeof v !== 'string' || v.length < 12 || v.length > 200) fail(400,'Le mot de passe doit contenir entre 12 et 200 caractères'); return v; }
function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const r=fn(); db.exec('COMMIT'); return r; } catch(e) { db.exec('ROLLBACK'); throw e; } }
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
async function readJson(req) { let raw=''; for await(const chunk of req) {raw+=chunk; if(Buffer.byteLength(raw)>65536) fail(413,'Requête trop volumineuse');} try {const b=JSON.parse(raw||'{}'); if(!b || Array.isArray(b) || typeof b!=='object') fail(400,'JSON invalide'); return b;} catch {fail(400,'JSON invalide');} }
function session(req) { const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('etudia_session='))?.slice(15); return token && db.prepare('SELECT a.id,a.establishment_id,a.person_id,a.email,a.role FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token=? AND s.expires>?').get(token,Date.now()); }
const attempts=new Map();
const publicDir=path.join(__dirname,'../public');
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','same-origin');
 try {
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET' && url.pathname==='/health') return json(res,200,{status:'ok'});
 if(!url.pathname.startsWith('/api/')) { const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}; const f=files[url.pathname]; if(req.method!=='GET'||!f) return json(res,404,{error:'Page inconnue'}); res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"); res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'); return res.end(fs.readFileSync(path.join(publicDir,f))); }
 if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`${process.env.ETUDIA_HTTPS==='1'?'https':'http'}://${req.headers.host}`) fail(403,'Origine refusée');
 const initialized=!!db.prepare('SELECT id FROM accounts LIMIT 1').get();
 if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{initialized});
 if(req.method==='POST' && url.pathname==='/api/setup') { if(initialized) fail(409,'Installation déjà effectuée'); const b=await readJson(req); const name=required(b.name,'Établissement'),email=required(b.email,'Email').toLowerCase(),p=password(b.password),country=required(b.country,'Pays'); if(!email.includes('@')) fail(400,'Email invalide'); transaction(()=>{if(db.prepare('SELECT id FROM accounts LIMIT 1').get()) fail(409,'Installation déjà effectuée');const id=db.prepare('INSERT INTO establishments(name,country,city) VALUES(?,?,?)').run(name,country,b.city?required(b.city,'Ville'):null).lastInsertRowid; const salt=crypto.randomBytes(16).toString('hex'); db.prepare('INSERT INTO accounts(establishment_id,email,password_hash,salt,role) VALUES(?,?,?,?,?)').run(id,email,hash(p,salt),salt,'administrator');}); return json(res,201,{created:true}); }
 if(req.method==='POST' && url.pathname==='/api/login') { const key=req.socket.remoteAddress,now=Date.now(); let a=attempts.get(key); if(!a || now-a.at>900000) {a={count:0,at:now}; attempts.set(key,a);} if(a.count>=10) fail(429,'Trop de tentatives. Réessayez dans 15 minutes.'); a.count++; const b=await readJson(req); const user=db.prepare('SELECT * FROM accounts WHERE email=?').get(String(b.email||'').trim().toLowerCase()); const computed=hash(String(b.password||'').slice(0,200),user?.salt||'dummy'); if(!user||!crypto.timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(user.password_hash,'hex'))) fail(401,'Identifiants incorrects'); attempts.delete(key); const token=crypto.randomBytes(32).toString('hex'); db.prepare('DELETE FROM sessions WHERE expires<=?').run(now); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,now+8*3600000); res.setHeader('Set-Cookie',`etudia_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.ETUDIA_HTTPS==='1'?'; Secure':''}`); return json(res,200,{connected:true}); }
 const user=session(req); if(!user) fail(401,'Connexion requise');
 if(req.method==='POST'&&url.pathname==='/api/logout') {db.prepare('DELETE FROM sessions WHERE account_id=?').run(user.id);res.setHeader('Set-Cookie','etudia_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{disconnected:true});}
 if(req.method==='GET'&&url.pathname==='/api/me') return json(res,200,user);
 if(user.role!=='administrator') fail(403,'Accès réservé à l’administration');
 const id=user.establishment_id;
 if(req.method==='GET'&&url.pathname==='/api/overview') return json(res,200,{school:db.prepare('SELECT * FROM establishments WHERE id=?').get(id),years:db.prepare('SELECT * FROM academic_years WHERE establishment_id=? ORDER BY starts_on DESC').all(id),classes:db.prepare('SELECT c.*, y.label AS year FROM classes c JOIN academic_years y ON y.id=c.academic_year_id WHERE c.establishment_id=? ORDER BY c.name').all(id),people:db.prepare('SELECT id,role,first_name,last_name,email,status FROM people WHERE establishment_id=? ORDER BY last_name').all(id),subjects:db.prepare('SELECT * FROM subjects WHERE establishment_id=? ORDER BY name').all(id)});
 if(req.method==='POST') { const b=await readJson(req);
 if(url.pathname==='/api/years') {const label=required(b.label,'Libellé'); const dates=[b.startsOn,b.endsOn]; if(dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d)))||b.startsOn>=b.endsOn) fail(400,'Dates invalides');transaction(()=>{if(b.active)db.prepare('UPDATE academic_years SET is_active=0 WHERE establishment_id=?').run(id);db.prepare('INSERT INTO academic_years(establishment_id,label,starts_on,ends_on,is_active) VALUES(?,?,?,?,?)').run(id,label,b.startsOn,b.endsOn,b.active?1:0);}); }
 else if(url.pathname==='/api/classes') {const year=Number(b.yearId);if(!db.prepare('SELECT id FROM academic_years WHERE id=? AND establishment_id=?').get(year,id)) fail(400,'Année scolaire inconnue');const capacity=Number(b.capacity);if(!Number.isInteger(capacity)||capacity<1||capacity>1000) fail(400,'Effectif maximal invalide');db.prepare('INSERT INTO classes(establishment_id,academic_year_id,name,capacity) VALUES(?,?,?,?)').run(id,year,required(b.name,'Classe'),capacity);}
 else if(url.pathname==='/api/subjects') db.prepare('INSERT INTO subjects(establishment_id,name) VALUES(?,?)').run(id,required(b.name,'Matière'));
 else if(url.pathname==='/api/people') {if(!['student','parent','teacher','administrator'].includes(b.role)) fail(400,'Rôle invalide');const first=required(b.firstName,'Prénom'),last=required(b.lastName,'Nom'),email=required(b.email,'Email').toLowerCase(),p=password(b.password);if(!email.includes('@'))fail(400,'Email invalide');transaction(()=>{const person=db.prepare("INSERT INTO people(establishment_id,role,first_name,last_name,email,status) VALUES(?,?,?,?,?,'active')").run(id,b.role,first,last,email).lastInsertRowid;const salt=crypto.randomBytes(16).toString('hex');db.prepare('INSERT INTO accounts(establishment_id,person_id,email,password_hash,salt,role) VALUES(?,?,?,?,?,?)').run(id,person,email,hash(p,salt),salt,b.role);});}
 else fail(404,'Route inconnue'); return json(res,201,{created:true}); }
 fail(404,'Route inconnue');
 } catch(e) {const conflict=/UNIQUE constraint/.test(e.message); if(!e.status&&!conflict)console.error(e);json(res,e.status||(conflict?409:500),{error:e.status?e.message:conflict?'Cet enregistrement existe déjà':'Erreur interne du serveur'});}
});
server.listen(Number(process.env.PORT||3030),process.env.HOST||'127.0.0.1',()=>console.log('Étudia : http://localhost:'+(process.env.PORT||3030)));
