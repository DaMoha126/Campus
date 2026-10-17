onRecordCreate(e=>require(__hooks+'/school-finance.cjs').enrollment(e),'enrollments');
onRecordUpdate(e=>require(__hooks+'/school-finance.cjs').enrollment(e),'enrollments');
onRecordCreateRequest(e=>{
  if(e.auth && e.auth.collection().name==='school_users')e.record.set('recorded_by',e.auth.id);
  e.next();
},'payments');
onRecordCreate(e=>require(__hooks+'/school-finance.cjs').payment(e),'payments');
