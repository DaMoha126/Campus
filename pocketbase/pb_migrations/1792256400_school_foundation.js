migrate((app) => {
  const text = (name, required = true) => ({name, type: 'text', required, max: 200});
  const school = new Collection({name: 'establishments', type: 'base', fields: [text('name'), text('country'), text('city', false)]});
  app.save(school);
  const relation = (name, collection) => ({name, type: 'relation', collectionId: collection.id, required: true, maxSelect: 1, cascadeDelete: false});
  const admin = '@request.auth.id != "" && @request.auth.collectionName = "school_users" && @request.auth.role = "administrator"';
  const own = admin + ' && establishment_id = @request.auth.establishment_id';
  const users = new Collection({name: 'school_users', type: 'auth',
    listRule: own, viewRule: '(' + own + ') || id = @request.auth.id',
    createRule: own, updateRule: null, deleteRule: null, manageRule: null,
    passwordAuth: {enabled: true, identityFields: ['email']},
    fields: [relation('establishment_id', school), text('first_name'), text('last_name'),
      {name:'role',type:'select',required:true,maxSelect:1,values:['administrator','teacher','parent','student']}]
  });
  app.save(users);
  users.fields.getByName('password').min = 12;
  users.authToken.duration = 28800;
  app.save(users);
  school.listRule = admin + ' && id = @request.auth.establishment_id';
  school.viewRule = school.listRule;
  app.save(school);
  const years = new Collection({name:'academic_years', type:'base', listRule:own,viewRule:own,createRule:own,updateRule:null,deleteRule:null,
    fields:[relation('establishment_id',school), text('label'),
      {name:'starts_on',type:'date',required:true},{name:'ends_on',type:'date',required:true},
      {name:'is_active',type:'bool'}],
    indexes:['CREATE UNIQUE INDEX idx_year_school_label ON academic_years (establishment_id, label)', 'CREATE UNIQUE INDEX idx_one_active_year ON academic_years (establishment_id) WHERE is_active = TRUE']});
  app.save(years);
  const classes = new Collection({name:'classes',type:'base',listRule:own,viewRule:own,
    createRule:own+' && academic_year_id.establishment_id = @request.auth.establishment_id', updateRule:null,deleteRule:null,
    fields:[relation('establishment_id',school),relation('academic_year_id',years),text('name'),{name:'capacity',type:'number',required:true,min:1,max:1000,onlyInt:true}],
    indexes:['CREATE UNIQUE INDEX idx_class_school_year_name ON classes (establishment_id, academic_year_id, name)']});
  app.save(classes);
  app.save(new Collection({name:'subjects',type:'base',listRule:own,viewRule:own,createRule:own,updateRule:null,deleteRule:null,
    fields:[relation('establishment_id',school),text('name')],indexes:['CREATE UNIQUE INDEX idx_subject_school_name ON subjects (establishment_id, name)']}));
  const settings=app.settings(); settings.meta.appName='Étudia'; settings.rateLimits.enabled=true; app.save(settings);
}, (app) => {
  for (const name of ['subjects','classes','academic_years','school_users','establishments']) app.delete(app.findCollectionByNameOrId(name));
});
