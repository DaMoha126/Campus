migrate((app) => {
  const rel=(name,target)=>({name,type:'relation',collectionId:app.findCollectionByNameOrId(target).id,required:true,maxSelect:1,cascadeDelete:false});
  const text=(name,required=true)=>({name,type:'text',required,max:200});
  const own='@request.auth.id != "" && @request.auth.collectionName = "school_users" && @request.auth.role = "administrator" && establishment_id = @request.auth.establishment_id';
  const enrollment=new Collection({name:'enrollments',type:'base',listRule:own,viewRule:own,createRule:own,updateRule:own,deleteRule:null,
    fields:[rel('establishment_id','establishments'),rel('student_id','school_users'),rel('academic_year_id','academic_years'),rel('class_id','classes'),
      text('enrolled_on'),{name:'registration_fee',type:'number',min:0,max:1000000000,onlyInt:true},{name:'tuition_fee',type:'number',min:0,max:1000000000,onlyInt:true},
      {name:'created',type:'autodate',onCreate:true},{name:'updated',type:'autodate',onCreate:true,onUpdate:true}],
    indexes:['CREATE UNIQUE INDEX idx_student_year_enrollment ON enrollments(student_id, academic_year_id)','CREATE INDEX idx_enrollment_school ON enrollments(establishment_id)','CREATE INDEX idx_enrollment_class ON enrollments(class_id)']});
  app.save(enrollment);
  app.save(new Collection({name:'payments',type:'base',listRule:own,viewRule:own,createRule:own,updateRule:null,deleteRule:null,
    fields:[rel('establishment_id','establishments'),rel('enrollment_id','enrollments'),rel('recorded_by','school_users'),
      {name:'amount',type:'number',required:true,min:1,max:2000000000,onlyInt:true},text('paid_on'),
      {name:'method',type:'select',required:true,maxSelect:1,values:['cash','mobile_money','bank_transfer','cheque']},text('reference',false),text('request_key'),
      {name:'created',type:'autodate',onCreate:true}],
    indexes:['CREATE UNIQUE INDEX idx_payment_request ON payments(establishment_id, request_key)','CREATE INDEX idx_payment_enrollment ON payments(enrollment_id)','CREATE INDEX idx_payment_school ON payments(establishment_id)']}));
}, (app)=>{
  app.delete(app.findCollectionByNameOrId('payments'));
  app.delete(app.findCollectionByNameOrId('enrollments'));
});
