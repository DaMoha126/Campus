const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
test('PocketBase upgrade preserves existing school records',{skip:!process.env.POCKETBASE_BIN},()=>{
const root=fs.mkdtempSync(path.join(os.tmpdir(),'etudia-upgrade-'));try{const old=path.join(root,'old');fs.mkdirSync(old);const file='1792256400_school_foundation.js';fs.copyFileSync(path.join('pocketbase/pb_migrations',file),path.join(old,file));const data=path.join(root,'data');
const migrate=migrations=>{const r=spawnSync(process.env.POCKETBASE_BIN,['migrate','up','--dev=false','--dir='+data,'--migrationsDir='+path.resolve(migrations)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};migrate(old);
let db=new DatabaseSync(path.join(data,'data.db'));db.prepare('INSERT INTO establishments(id,name,country,city) VALUES(?,?,?,?)').run('preserved123456','École existante','Burkina Faso','Ouagadougou');db.close();
migrate('pocketbase/pb_migrations');migrate('pocketbase/pb_migrations');db=new DatabaseSync(path.join(data,'data.db'));assert.equal(db.prepare('SELECT name FROM establishments WHERE id=?').get('preserved123456').name,'École existante');assert.equal(db.prepare('SELECT COUNT(*) n FROM enrollments').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM payments').get().n,0);db.close();
}finally{fs.rmSync(root,{recursive:true,force:true});}
});
