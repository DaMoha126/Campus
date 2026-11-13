const {JSDOM,VirtualConsole}=require('jsdom');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-ui-')),base='http://127.0.0.1:13031';
const child=spawn(process.execPath,[path.join(__dirname,'index.cjs')],{env:{...process.env,PORT:'13031',ETUDIA_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
let dom;
async function until(fn){for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Attente expirée');}
(async()=>{
 try{
 await once(child.stdout,'data');
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 dom=await JSDOM.fromURL(base,{runScripts:'dangerously',resources:'usable',virtualConsole:vc,beforeParse(w){w.fetch=(url,options)=>fetch(new URL(url,base),options);}});
 const w=dom.window,d=w.document;
 if(d.readyState!=='complete')await new Promise(r=>w.addEventListener('load',r,{once:true}));
 const role=d.querySelector('#role');role.value='Administration';role.dispatchEvent(new w.Event('change',{bubbles:true}));
 await until(()=>d.querySelector('[data-live-add="school"]'));
 async function add(type,values,ready){
  d.querySelector('[data-live-add="'+type+'"]').click();
  const f=d.querySelector('#live-form');assert.ok(f,'Formulaire '+type);
  for(const [key,val] of Object.entries(values))f.elements.namedItem(key).value=val;
  f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>!d.querySelector('#live-form')&&ready());
 }
 await add('school',{name:'École interface',country:'Burkina Faso',city:'Ouagadougou'},()=>d.querySelector('#content').textContent.includes('École interface'));
 function go(page){d.querySelector('#nav [data-go="'+page+'"]').click();}
 go('structure');
 await add('year',{label:'2026-2027',startsOn:'2026-09-01',endsOn:'2027-07-01'},()=>d.querySelector('#content').textContent.includes('2026-2027'));
 go('classes');
 await add('class',{name:'3e A',capacity:'30'},()=>d.querySelector('#content').textContent.includes('3e A'));
 go('students');
 await add('student',{firstName:'Élève',lastName:'Test',email:'test@example.com'},()=>d.querySelector('#content').textContent.includes('Élève Test'));
 go('teachers');
 await add('teacher',{firstName:'Prof',lastName:'Test'},()=>d.querySelector('#content').textContent.includes('Prof Test'));
 go('home');assert.match(d.querySelector('#content').textContent,/Classes/);
 assert.deepEqual(errors,[]);
 dom.window.close();dom=null;
 dom=await JSDOM.fromURL(base,{runScripts:'dangerously',resources:'usable',virtualConsole:vc,beforeParse(w){w.fetch=(url,opts)=>fetch(new URL(url,base),opts);}});
 if(dom.window.document.readyState!=='complete')await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));
 const r=dom.window.document.querySelector('#role');r.value='Administration';r.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 await until(()=>dom.window.document.querySelector('#content').textContent.includes('École interface'));
 assert.deepEqual(errors,[]);
 console.log('PASS UI : établissement, année, classe, élève, enseignant, compteurs et rechargement sans erreur JavaScript.');
 }finally{dom?.window.close();const done=once(child,'exit');child.kill();await done;fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
