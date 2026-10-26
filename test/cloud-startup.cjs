const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
test('cloud startup initializes once, validates origins and keeps data on restart',{skip:!process.env.POCKETBASE_BIN},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etudia-cloud-start-'));
 let proc, logs='';
 const password=require('node:crypto').randomBytes(24).toString('hex');
 const data=path.join(dir,'data');
 const stop=async()=>{if(proc&&proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);proc.kill()})}};
 const request=(host,origin)=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:31369,path:'/api/health',headers:{Host:host,...(origin?{Origin:origin}:{})}},r=>{r.resume();resolve(r.statusCode)});req.on('error',reject);req.end();
 });
 try{
  fs.copyFileSync(process.env.POCKETBASE_BIN,path.join(dir,'pocketbase'));fs.chmodSync(path.join(dir,'pocketbase'),0o700);
  for(const name of ['pb_migrations','pb_hooks','pb_public'])fs.symlinkSync(path.resolve('pocketbase',name),path.join(dir,name));
  const script=fs.readFileSync('scripts/start-cloud.sh','utf8').replaceAll('/app/',dir+'/');
  fs.writeFileSync(path.join(dir,'start.sh'),script);
  const start=async(first)=>{
   proc=spawn('sh',[path.join(dir,'start.sh')],{env:{...process.env,PORT:'31369',ETUDIA_DATA_DIR:data,RENDER_EXTERNAL_HOSTNAME:'etudia-test.onrender.com',...(first?{ETUDIA_SUPERUSER_EMAIL:'cloud@fixture.invalid',ETUDIA_SUPERUSER_PASSWORD:password}:{})}});
   proc.stdout.on('data',x=>logs+=x);proc.stderr.on('data',x=>logs+=x);
   for(let i=0;i<150;i++){
    try{if(await request('etudia-test.onrender.com')===200)return}catch{}
    if(proc.exitCode!==null)throw Error(logs);
    await new Promise(r=>setTimeout(r,30));
   }
   throw Error('Startup timeout: '+logs);
  };
  await start(true);
  assert.equal(await request('etudia-test.onrender.com','https://etudia-test.onrender.com'),200);
  assert.equal(await request('etudia-test.onrender.com','https://evil.example'),403);
  assert.equal(await request('etudia-test.onrender.com','http://etudia-test.onrender.com'),403);
  assert.equal(await request('evil.example'),403);
  const login=async()=>{
   const r=await fetch('http://127.0.0.1:31369/api/collections/_superusers/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:'cloud@fixture.invalid',password})});
   assert.equal(r.status,200);return (await r.json()).record.id;
  };
  const id=await login();
  assert.ok(fs.existsSync(path.join(data,'.etudia-initialized')));
  await stop(); await start(false);
  assert.equal(await login(),id);
  assert.ok(!logs.includes(password));
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
