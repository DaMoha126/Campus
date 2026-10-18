migrate((app) => {
  const users=app.findCollectionByNameOrId('school_users');
  users.fields.getByName('password').min=8;
  app.save(users);
}, (app) => {
  const users=app.findCollectionByNameOrId('school_users');
  users.fields.getByName('password').min=12;
  app.save(users);
});
