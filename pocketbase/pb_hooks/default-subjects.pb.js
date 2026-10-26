// Seed inside the same transaction as establishment creation.
onRecordCreate((e) => {
  e.app.runInTransaction((tx) => {
    e.app = tx;
    e.next();
    require(__hooks + "/default-subjects.cjs").seedSubjects(tx, e.record.id);
  });
}, "establishments");
