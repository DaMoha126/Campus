const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn,spawnSync}=require('node:child_process');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');const binary=process.env.POCKETBASE_BIN;
test('PocketBase accounts, tenant permissions and persistence',{skip:!binary},async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etudia-pb-')),password=crypto.randomBytes(20).toString('hex');let proc;const args=['--dir='+dir,'--migrationsDir='+path.resolve('pocketbase/pb_migrations'),'--hooksDir='+path.resolve('pocketbase/pb_hooks'),'--publicDir='+path.resolve('pocketbase/pb_public'),'--dev=false','--automigrate=false'];const base='http://127.0.0.1:31358';
async function boot(){proc=spawn(binary,['serve','--http=127.0.0.1:31358',...args],{stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(proc.exitCode!==null)throw Error('Startup failed');await new Promise(r=>setTimeout(r,50));}throw Error('Timeout');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function req(route,body,token,method){const r=await fetch(base+'/api/'+route,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const record=(name,b,t)=>req('collections/'+name+'/records',b,t);const user=(email,school,role)=>({email,password,passwordConfirm:password,emailVisibility:true,first_name:'Ben',last_name:'Dao',role,establishment_id:school});
try{const init=spawnSync(binary,['superuser','create','root@test.invalid',password,...args],{encoding:'utf8'});assert.equal(init.status,0,init.stderr);await boot();const root=(await req('collections/_superusers/auth-with-password',{identity:'root@test.invalid',password})).data.token;assert.ok(root);
const a=(await record('establishments',{name:'École A',country:'BF'},root)).data,b=(await record('establishments',{name:'École B',country:'BF'},root)).data;
assert.equal((await record('school_users',user('admin@test.invalid',a.id,'administrator'),root)).status,200);
const admin=(await req('collections/school_users/auth-with-password',{identity:'admin@test.invalid',password})).data.token;assert.ok(admin);
assert.equal((await record('subjects',{name:'Sans connexion',establishment_id:a.id})).status,400);
assert.equal((await record('school_users',user('student@test.invalid',a.id,'student'),admin)).status,200);
const student=(await req('collections/school_users/auth-with-password',{identity:'student@test.invalid',password})).data;
assert.equal((await record('subjects',{name:'Interdit',establishment_id:a.id},student.token)).status,400);
assert.equal((await req('collections/school_users/records/'+student.record.id,{role:'administrator'},student.token,'PATCH')).status,403);
assert.equal((await record('subjects',{name:'Maths',establishment_id:b.id},admin)).status,400);
assert.equal((await record('subjects',{name:'Maths',establishment_id:a.id},admin)).status,200);
assert.equal((await req('collections/establishments/records/'+b.id,undefined,admin)).status,404);
const year={label:'2026–2027',starts_on:'2026-09-01 00:00:00.000Z',ends_on:'2027-07-01 00:00:00.000Z',is_active:true};
assert.equal((await record('academic_years',{...year,establishment_id:a.id,ends_on:'2025-01-01 00:00:00.000Z'},admin)).status,400);
const ay=await record('academic_years',{...year,establishment_id:a.id},admin);assert.equal(ay.status,200);
const by=(await record('academic_years',{...year,establishment_id:b.id},root)).data;
assert.equal((await record('classes',{name:'Intrusion',establishment_id:a.id,academic_year_id:by.id,capacity:30},admin)).status,400);
assert.equal((await record('classes',{name:'3e A',establishment_id:a.id,academic_year_id:ay.data.id,capacity:30},admin)).status,200);
assert.equal((await req('collections/classes/records',undefined,admin)).data.items.length,1);
assert.equal((await req('collections/classes/records',undefined,student.token)).data.items.length,0);

const studentId=student.record.id;
const form={establishment_id:a.id,student_id:studentId,academic_year_id:ay.data.id,class_id:(await req('collections/classes/records',undefined,admin)).data.items[0].id,enrolled_on:'2026-10-17',registration_fee:20000,tuition_fee:100000};
const ins=await record('enrollments',form,admin);assert.equal(ins.status,200,JSON.stringify(ins.data));
assert.equal((await record('enrollments',form,admin)).status,400);
assert.equal((await record('enrollments',{...form,student_id:(await record('school_users',user('teacher@test.invalid',a.id,'teacher'),admin)).data.id},admin)).status,400);
assert.equal((await record('enrollments',{...form,class_id:'invalidclass123'},admin)).status,400);
const payment={establishment_id:a.id,enrollment_id:ins.data.id,recorded_by:studentId,amount:20000,paid_on:'2026-10-17',method:'cash',reference:'TEST',request_key:'first-payment'};
const pay=await record('payments',payment,admin);assert.equal(pay.status,200,JSON.stringify(pay.data));assert.notEqual(pay.data.recorded_by,studentId);
assert.equal((await record('payments',payment,admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'overpay',amount:100001},admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'zero',amount:0},admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'negative',amount:-1},admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'fraction',amount:1.5},admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'other-school',establishment_id:b.id},admin)).status,400);
assert.equal((await record('payments',{...payment,request_key:'student'},student.token)).status,400);
assert.equal((await req('collections/payments/records/'+pay.data.id,{amount:1},admin,'PATCH')).status,403);
assert.equal((await req('collections/payments/records/'+pay.data.id,undefined,admin,'DELETE')).status,403);
assert.equal((await req('collections/enrollments/records/'+ins.data.id,{registration_fee:0,tuition_fee:1000},admin,'PATCH')).status,400);
const small=(await record('classes',{name:'Classe limitée',establishment_id:a.id,academic_year_id:ay.data.id,capacity:1},admin)).data;
const transfer=await req('collections/enrollments/records/'+ins.data.id,{class_id:small.id},admin,'PATCH');assert.equal(transfer.status,200,JSON.stringify(transfer.data));
const secondStudent=(await record('school_users',user('second@test.invalid',a.id,'student'),admin)).data;
assert.equal((await record('enrollments',{...form,student_id:secondStudent.id,class_id:small.id},admin)).status,400);
assert.equal((await req('collections/enrollments/records/'+ins.data.id,{student_id:secondStudent.id},admin,'PATCH')).status,400);
const payments=await Promise.all([record('payments',{...payment,amount:60000,request_key:'concurrent-a'},admin),record('payments',{...payment,amount:60000,request_key:'concurrent-b'},admin)]);
assert.equal(payments.filter(p=>p.status===200).length,1,JSON.stringify(payments));
const ledger=(await req('collections/payments/records',undefined,admin)).data.items;assert.equal(ledger.reduce((s,p)=>s+p.amount,0),80000);
assert.equal((await req('collections/enrollments/records',undefined,student.token)).data.items.length,0);
assert.equal((await req('collections/payments/records',undefined,student.token)).data.items.length,0);

// Exercise the actual frontend adapter against the live PocketBase API and render templates.
const vm=require('node:vm');const elements={'#app':{innerHTML:'',textContent:'',addEventListener(){}},'#notice':{textContent:''},'#logout':{hidden:true,addEventListener(){}}};
const context=vm.createContext({console,fetch:(url,options)=>fetch(base+url,options),crypto:crypto.webcrypto,Intl,Date,URL,Blob,setTimeout:()=>0,clearTimeout(){},FormData,document:{querySelector:s=>elements[s]||null,addEventListener(){},querySelectorAll:()=>[]},window:{confirm:()=>true}});
vm.runInContext(fs.readFileSync('pocketbase/pb_public/finance.js','utf8'),context);vm.runInContext(fs.readFileSync('pocketbase/pb_public/app.js','utf8'),context);await vm.runInContext('start()',context);
context.existingToken=admin;context.existingUser=(await req('collections/school_users/records',undefined,admin)).data.items.find(u=>u.email==='admin@test.invalid');await vm.runInContext('authToken=existingToken;currentUser=existingUser;start()',context);
assert.match(elements['#app'].innerHTML,/Registre des inscriptions/);assert.match(elements['#app'].innerHTML,/Partiel/);
context.chosen=ins.data.id;await vm.runInContext('selectedEnrollment=chosen;start()',context);assert.match(elements['#app'].innerHTML,/Historique des versements/);assert.match(elements['#app'].innerHTML,/name="amount"/);
context.paymentBody={enrollment_id:ins.data.id,amount:'40000',paid_on:'2026-10-17',method:'mobile_money',reference:'Solde',request_key:'ui-adapter'};await vm.runInContext("api('payments',paymentBody)",context);await vm.runInContext('start()',context);assert.match(elements['#app'].innerHTML,/Soldé/);
await vm.runInContext("adminPage='structure';start()",context);assert.match(elements['#app'].innerHTML,/Annuaire de l’établissement/);
assert.equal((await fetch(base)).status,200);await stop();

await boot();assert.equal((await req('collections/classes/records',undefined,admin)).data.items.length,2);
assert.equal((await req('collections/payments/records',undefined,admin)).data.items.reduce((s,p)=>s+p.amount,0),120000);
}finally{if(proc?.exitCode===null)await stop();fs.rmSync(dir,{recursive:true,force:true});}
});
