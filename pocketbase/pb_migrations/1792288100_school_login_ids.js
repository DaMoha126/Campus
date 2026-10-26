migrate((app) => {
  const users = app.findCollectionByNameOrId("school_users");
  users.fields.add(
    new TextField({ name: "login_id", max: 40, pattern: "^[A-Za-z0-9._-]+$" }),
  );
  users.fields.getByName("email").required = false;
  app.save(users);
  for (const u of app.findRecordsByFilter("school_users", "", "", 0, 0)) {
    u.set("login_id", "E" + $security.randomString(10).toUpperCase());
    app.save(u);
  }
  users.indexes.push(
    "CREATE UNIQUE INDEX idx_school_login ON school_users(login_id)",
  );
  users.passwordAuth.identityFields = ["email", "login_id"];
  app.save(users);
});
