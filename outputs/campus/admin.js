/* Local administration: the role selector is not authentication. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const state={schools:[],id:Number(localStorage.getItem('campus-school')),years:[],classes:[],people:[],subjects:[],counts:{},loading:true,error:''};
 let sequence=0;
 async function api(route,body){const r=await fetch('/api/establishments'+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw Error(d.error||'Enregistrement impossible');return d;}
 async function load(){
  const seq=++sequence;state.loading=true;state.error='';render();
  try{
   const schools=await api('');
   if(seq!==sequence)return;
   state.schools=schools;
   if(!schools.some(s=>s.id===state.id))state.id=schools[0]?.id||0;
   const id=state.id;
   const data=id?await Promise.all(['academic-years','classes','people','subjects','dashboard'].map(k=>api('/'+id+'/'+k))):[[],[],[],[],{}];
   if(seq!==sequence)return;
   [state.years,state.classes,state.people,state.subjects,state.counts]=data;
   localStorage.setItem('campus-school',id);
  }catch(e){if(seq===sequence)state.error=e.message;}
  finally{if(seq===sequence){state.loading=false;render();}}
 }
 const button=(type,label)=>'<button class="primary" data-live-add="'+type+'">'+label+'</button>';
 const header=()=>'<section class="panel"><label>Établissement <select id="live-school" '+(state.loading?'disabled':'')+'>'+state.schools.map(s=>'<option value="'+s.id+'" '+(s.id===state.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label> '+button('school','Nouvel établissement')+'<p class="note">Administration locale · données SQLite. Les autres espaces restent en démonstration. Aucun compte utilisateur sécurisé n’est encore activé.</p></section>';
 const list=(items,fn)=>items.length?items.map(fn).join(''):'<p class="note">Aucune donnée enregistrée.</p>';
 const item=(a,b)=>'<div class="row"><div><b>'+esc(a)+'</b><span>'+esc(b)+'</span></div></div>';
 function section(title,controls,content){return header()+'<section class="panel" style="margin-top:18px"><div class="section-head"><h2>'+title+'</h2><div class="quick">'+controls+'</div></div>'+content+'</section>';}
 function screen(kind){
  if(state.loading)return header()+'<p role="status">Chargement des données…</p>';
  if(state.error)return header()+'<p role="alert">'+esc(state.error)+'</p><button data-live-reload>Réessayer</button>';
  if(!state.id)return header()+'<p class="note">Créez votre premier établissement pour commencer.</p>';
  const school=state.schools.find(s=>s.id===state.id);
  if(kind==='home')return section('Administration de '+esc(school.name),'',cards([['Élèves',state.counts.students||0,'Enregistrés'],['Enseignants',state.counts.teachers||0,'Enregistrés'],['Classes',state.counts.classes||0,'Enregistrées']])+'<div class="quick"><button data-go="structure">Années et matières</button><button data-go="classes">Classes</button><button data-go="students">Élèves et parents</button><button data-go="teachers">Enseignants</button></div>');
  if(kind==='structure'||kind==='settings')return section('Structure scolaire',button('year','Ajouter une année')+button('subject','Ajouter une matière'),'<h3>Années scolaires</h3>'+list(state.years,x=>item(x.label,x.starts_on+' → '+x.ends_on))+'<h3>Matières</h3>'+list(state.subjects,x=>item(x.name,'')));
  if(kind==='classes')return section('Classes',button('class','Ajouter une classe'),list(state.classes,x=>item(x.name,(state.years.find(y=>y.id===x.academic_year_id)?.label||'')+' · capacité : '+(x.capacity??'non définie'))));
  const teacher=kind==='teachers', people=state.people.filter(p=>teacher?p.role==='teacher':['student','parent'].includes(p.role));
  return section(teacher?'Enseignants':'Élèves et parents',teacher?button('teacher','Ajouter un enseignant'):button('student','Ajouter un élève')+button('parent','Ajouter un parent'),list(people,x=>item(x.first_name+' '+x.last_name,({student:'Élève',parent:'Parent',teacher:'Enseignant'}[x.role])+' · '+(x.email||x.phone||'Sans coordonnées'))));
 }
 const original={...screens};
 for(const key of ['home','structure','settings','classes','students'])screens[key]=()=>role==='Administration'?screen(key):original[key]();
 screens.teachers=()=>role==='Administration'?screen('teachers'):'';
 if(!nav.Administration.some(x=>x[0]==='teachers'))nav.Administration.splice(4,0,['teachers','Enseignants']);
 labels.teachers=['Enseignants','Personnes enregistrées dans cet établissement.'];
 function field(name,label,type='text',extra=''){return '<label>'+label+'<input name="'+name+'" type="'+type+'" required maxlength="200" '+extra+'></label>';}
 function open(type){
  if(type!=='school'&&!state.id)return;
  if(type==='class'&&!state.years.length){notify('Ajoutez une année scolaire dans Structure scolaire.');return;}
  let fields='',title='',resource='';
  if(type==='school'){title='Nouvel établissement';fields=field('name','Nom')+field('country','Pays')+field('city','Ville','text');}
  else if(type==='year'){title='Année scolaire';resource='academic-years';fields=field('label','Libellé (ex. 2026-2027)')+field('startsOn','Début','date')+field('endsOn','Fin','date');}
  else if(type==='class'){title='Nouvelle classe';resource='classes';fields=field('name','Nom de la classe')+'<label>Année scolaire<select name="academicYearId" required>'+state.years.map(y=>'<option value="'+y.id+'">'+esc(y.label)+'</option>').join('')+'</select></label>'+field('capacity','Capacité','number','min="1" step="1"');}
  else if(type==='subject'){title='Nouvelle matière';resource='subjects';fields=field('name','Nom de la matière');}
  else{title={student:'Nouvel élève',parent:'Nouveau parent',teacher:'Nouvel enseignant'}[type];resource='people';fields=field('firstName','Prénom')+field('lastName','Nom')+'<label>Email<input name="email" type="email" maxlength="200"></label><label>Téléphone<input name="phone" type="tel" maxlength="200"></label>';}
  $('#modal').innerHTML='<div class="overlay"><form id="live-form"><button type="button" data-close aria-label="Fermer">×</button><h2>'+title+'</h2>'+fields+'<p role="alert" id="live-error"></p><button class="primary" type="submit">Enregistrer</button></form></div>';
  const form=$('#live-form'),id=state.id;
  form.addEventListener('submit',async e=>{
   e.preventDefault();e.stopImmediatePropagation();
   const submit=form.querySelector('[type=submit]');submit.disabled=true;
   const data=Object.fromEntries(new FormData(form));
   if(resource==='people')data.role=type;
   if(resource==='classes'){data.capacity=Number(data.capacity);data.academicYearId=Number(data.academicYearId);}
   try{
    const result=await api(type==='school'?'':'/'+id+'/'+resource,data);
    if(type==='school')state.id=result.id;
    $('#modal').innerHTML='';await load();notify('Enregistré dans la base de données');
   }catch(err){form.querySelector('#live-error').textContent=err.message;submit.disabled=false;}
  });
  form.querySelector('input')?.focus();
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-live-add]');if(b){e.preventDefault();open(b.dataset.liveAdd);}if(e.target.closest('[data-live-reload]'))load();});
 document.addEventListener('change',e=>{if(e.target.id==='live-school'){state.id=Number(e.target.value);load();}});
 load();
})();
