onRecordValidate((e) => {
  if(e.record.getString('starts_on') >= e.record.getString('ends_on')) {
    throw new ValidationError('ends_on', 'La fin doit être postérieure au début.');
  }
  e.next();
}, 'academic_years');
