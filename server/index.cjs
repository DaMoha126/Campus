const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const port=Number(process.env.PORT||3030);
const dataDir=process.env.ETUDIA_DATA_DIR||path.join(__dirname,'data');
fs.mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'etudia.db'));
db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
const root=path.join(__dirname,'..','outputs','campus');
function text(v,name){if(typeof v!=='string'||!v.trim()||v.length>200)throw Error(name+' invalide');return v.trim();}
function positive(v,name){if(!Number.isSafeInteger(v)||v<1)throw Error(name+' invalide');return v;}
function optional(v){if(v==null||v==='')return null;return text(v,'Champ');}
async function body(req){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>65536)throw Error('Formulaire trop volumineux');}const b=JSON.parse(raw||'{}');if(!b||Array.isArray(b)||typeof b!=='object')throw Error('Formulaire invalide');return b;}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
 try{
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host))return json(res,403,{error:'Accès local uniquement'});
  const origin=req.headers.origin;
  if(origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(origin))return json(res,403,{error:'Origine refusée'});
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{status:'ok',database:'ready'});
  const staticFiles={'/':'index.html','/app.js':'app.js','/admin.js':'admin.js'};
  if(req.method==='GET'&&staticFiles[url.pathname]){
   const name=staticFiles[url.pathname];res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(root,name)));
  }
  if(url.pathname==='/api/establishments'){
   if(req.method==='GET')return json(res,200,db.prepare('SELECT * FROM establishments ORDER BY name').all());
   if(req.method==='POST'){const b=await body(req);const r=db.prepare('INSERT INTO establishments(name,country,city) VALUES(?,?,?)').run(text(b.name,'Nom'),text(b.country,'Pays'),optional(b.city));return json(res,201,db.prepare('SELECT * FROM establishments WHERE id=?').get(r.lastInsertRowid));}
  }
  const m=url.pathname.match(/^\/api\/establishments\/(\d+)\/(dashboard|academic-years|classes|people|subjects)$/);
  if(!m)return json(res,404,{error:'Route inconnue'});
  const id=positive(Number(m[1]),'Établissement'),resource=m[2];
  if(!db.prepare('SELECT id FROM establishments WHERE id=?').get(id))return json(res,404,{error:'Établissement introuvable'});
  if(resource==='dashboard'&&req.method==='GET'){
   const count=t=>db.prepare('SELECT COUNT(*) n FROM '+t+' WHERE establishment_id=?').get(id).n;
   return json(res,200,{classes:count('classes'),subjects:count('subjects'),students:db.prepare("SELECT COUNT(*) n FROM people WHERE establishment_id=? AND role='student'").get(id).n,teachers:db.prepare("SELECT COUNT(*) n FROM people WHERE establishment_id=? AND role='teacher'").get(id).n});
  }
  const table={'academic-years':'academic_years',classes:'classes',people:'people',subjects:'subjects'}[resource];
  if(!table)return json(res,405,{error:'Méthode refusée'});
  if(req.method==='GET')return json(res,200,db.prepare('SELECT * FROM '+table+' WHERE establishment_id=? ORDER BY id DESC').all(id));
  if(req.method!=='POST')return json(res,405,{error:'Méthode refusée'});
  const b=await body(req);let r;
  if(resource==='academic-years'){
   for(const d of [b.startsOn,b.endsOn]){if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Date invalide');}
   if(b.startsOn>=b.endsOn)throw Error('La fin doit suivre le début');
   r=db.prepare('INSERT INTO academic_years(establishment_id,label,starts_on,ends_on) VALUES(?,?,?,?)').run(id,text(b.label,'Année'),b.startsOn,b.endsOn);
  }
  if(resource==='classes'){
   const year=positive(b.academicYearId,'Année');
   if(!db.prepare('SELECT id FROM academic_years WHERE id=? AND establishment_id=?').get(year,id))throw Error('Année étrangère à cet établissement');
   const cap=b.capacity==null||b.capacity===''?null:positive(b.capacity,'Capacité');
   r=db.prepare('INSERT INTO classes(establishment_id,academic_year_id,name,capacity) VALUES(?,?,?,?)').run(id,year,text(b.name,'Classe'),cap);
  }
  if(resource==='subjects')r=db.prepare('INSERT INTO subjects(establishment_id,name) VALUES(?,?)').run(id,text(b.name,'Matière'));
  if(resource==='people'){
   if(!['student','teacher','parent','administrator'].includes(b.role))throw Error('Rôle invalide');
   r=db.prepare('INSERT INTO people(establishment_id,role,first_name,last_name,email,phone) VALUES(?,?,?,?,?,?)').run(id,b.role,text(b.firstName,'Prénom'),text(b.lastName,'Nom'),optional(b.email),optional(b.phone));
  }
  return json(res,201,db.prepare('SELECT * FROM '+table+' WHERE id=?').get(r.lastInsertRowid));
 }catch(e){return json(res,400,{error:e.code?.startsWith('ERR_SQLITE')?'Données refusées : vérifier les références et les doublons.':e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log('Campus local : http://127.0.0.1:'+port));
function shutdown(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
