const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-test-'));
const port=13030,base='http://127.0.0.1:'+port;
let child;
async function start(){
 child=spawn(process.execPath,[path.join(__dirname,'index.cjs')],{env:{...process.env,PORT:String(port),ETUDIA_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Démarrage expiré')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error('Serveur arrêté'));});});
}
async function stop(){const p=child;child=null;if(p){const done=once(p,'exit');p.kill();await done;}}
async function api(route,data){const r=await fetch(base+'/api/establishments'+route,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});return {status:r.status,data:await r.json()};}
(async()=>{
 try{
 await start();
 assert.equal((await fetch(base+'/')).status,200);
 assert.match(await (await fetch(base+'/')).text(),/src="admin.js"/);
 assert.equal((await fetch(base+'/admin.js')).status,200);
 assert.equal((await fetch(base+'/api/establishments',{headers:{Origin:'https://example.com'}})).status,403);
 const a=(await api('',{name:'École test',country:'Burkina Faso',city:'Ouagadougou'})).data;
 const b=(await api('',{name:'Autre école',country:'Burkina Faso'})).data;
 const y=await api('/'+a.id+'/academic-years',{label:'2026-2027',startsOn:'2026-09-01',endsOn:'2027-07-01'});assert.equal(y.status,201);
 assert.equal((await api('/'+a.id+'/academic-years',{label:'Mauvaise date',startsOn:'2026-02-30',endsOn:'2027-01-01'})).status,400);
 const c=await api('/'+a.id+'/classes',{name:'3e A',academicYearId:y.data.id,capacity:30});assert.equal(c.status,201);
 assert.equal((await api('/'+b.id+'/classes',{name:'Interdit',academicYearId:y.data.id,capacity:30})).status,400);
 assert.equal((await api('/'+a.id+'/classes',{name:'3e A',academicYearId:y.data.id,capacity:30})).status,400);
 assert.equal((await api('/'+a.id+'/people',{role:'student',firstName:'Élève',lastName:'Test'})).status,201);
 assert.equal((await api('/'+a.id+'/people',{role:'teacher',firstName:'Prof',lastName:'Test'})).status,201);
 assert.equal((await api('/'+a.id+'/people',{role:'invalid',firstName:'X',lastName:'Y'})).status,400);
 assert.equal((await api('/'+a.id+'/people',{role:'student',firstName:' ',lastName:'Y'})).status,400);
 assert.equal((await api('/'+a.id+'/subjects',{name:'Mathématiques'})).status,201);
 assert.equal((await api('/999999/people')).status,404);
 assert.deepEqual((await api('/'+a.id+'/dashboard')).data,{classes:1,subjects:1,students:1,teachers:1});
 assert.deepEqual((await api('/'+b.id+'/people')).data,[]);
 await stop();await start();
 assert.equal((await api('/'+a.id+'/classes')).data[0].name,'3e A');
 assert.equal((await api('/'+a.id+'/people')).data.length,2);
 console.log('PASS : création, validations, isolation, compteurs, fichiers, origine et persistance après redémarrage.');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
