const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
test('free demo seeds fictitious accounts, shows warning and survives a fresh filesystem',{skip:!process.env.POCKETBASE_BIN},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etudia-demo-test-'));
 const data=path.join(dir,'etudia-demo-data'),password=require('node:crypto').randomBytes(24).toString('hex');
 let proc,browser,logs='';
 const stop=async()=>{if(proc&&proc.exitCode===null)await new Promise(r=>{proc.once('exit',r);proc.kill()})};
 const base='http://127.0.0.1:31370';
 try{
  fs.copyFileSync(process.env.POCKETBASE_BIN,path.join(dir,'pocketbase'));fs.chmodSync(path.join(dir,'pocketbase'),0o700);
  for(const name of ['pb_migrations','pb_hooks','pb_public'])fs.symlinkSync(path.resolve('pocketbase',name),path.join(dir,name));
  fs.writeFileSync(path.join(dir,'start.sh'),fs.readFileSync('scripts/start-cloud.sh','utf8').replaceAll('/app/',dir+'/'));
  const start=async()=>{
   proc=spawn('sh',[path.join(dir,'start.sh')],{env:{...process.env,PORT:'31370',ETUDIA_DEMO:'1',ETUDIA_DATA_DIR:data,ETUDIA_DEMO_PASSWORD:password,RENDER_EXTERNAL_HOSTNAME:'etudia-demo-test.onrender.com'}});
   proc.stdout.on('data',x=>logs+=x);proc.stderr.on('data',x=>logs+=x);
   for(let i=0;i<180;i++){
    try{if((await fetch(base+'/api/health')).ok)return}catch{}
    if(proc.exitCode!==null)throw Error(logs);
    await new Promise(r=>setTimeout(r,30));
   }
   throw Error('Demo startup timeout: '+logs);
  };
  const state=async(identity)=>{
   let login;
   for(let attempt=0;attempt<5;attempt++){
   login=await fetch(base+'/api/collections/school_users/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity,password})});
   if(login.status!==429)break;
   await new Promise(r=>setTimeout(r,1500));
   }

   assert.equal(login.status,200,await login.clone().text());
   const auth=await login.json();
   const r=await fetch(base+'/api/etudia/state',{headers:{Authorization:auth.token}});assert.equal(r.status,200);return r.json();
  };
  await start();
  assert.deepEqual(await (await fetch(base+'/api/etudia/config')).json(),{demo:true});
  const admin=await state('DEMOADMIN');
  assert.equal(admin.subjects.length,15);assert.equal(admin.people.length,4);assert.equal(admin.assignments.length,1);assert.equal(admin.timetable.length,1);
  assert.equal(admin.grades[0].score,16);assert.equal(admin.evaluations[0].published,true);
  for(const id of ['DEMOPROF','DEMOELEVE','DEMOPARENT'])assert.equal((await state(id)).evaluations.length,1);
  await new Promise(r=>setTimeout(r,3500));
  if(process.env.CHROME_BIN){
   const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
   browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
   const page=await browser.newPage();await page.goto(base);
   await page.locator('#demo-banner').waitFor({state:'visible'});
   await page.getByLabel('Email ou matricule').fill('DEMOADMIN');
   await page.getByLabel('Mot de passe',{exact:true}).fill(password);
   const response=page.waitForResponse(r=>r.url().includes('auth-with-password'));
   await page.getByRole('button',{name:'Se connecter',exact:true}).click();
   assert.equal((await response).status(),200);
   await page.getByRole('heading',{name:'Inscriptions & paiements',exact:true}).waitFor();
   await page.getByRole('button',{name:'Pédagogie & communications',exact:true}).click();
   await page.getByRole('button',{name:'Bulletins',exact:true}).click();
   await page.getByText('Moyenne générale : 16.00 /20',{exact:true}).waitFor();
   await browser.close();browser=null;
  }
  await stop();await start();assert.equal((await state('DEMOADMIN')).people.length,4);
  await stop();fs.rmSync(data,{recursive:true,force:true});await start();
  const fresh=await state('DEMOADMIN');assert.equal(fresh.people.length,4);assert.notEqual(fresh.school.id,admin.school.id);
  assert.ok(!logs.includes(password));
 }finally{if(browser)await browser.close();await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
