migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("school_users");
    const role = users.fields.getByName("role");
    role.values = [
      "administrator",
      "school_life",
      "accountant",
      "teacher",
      "parent",
      "student",
    ];
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("school_users");
    for (const user of app.findRecordsByFilter(
      "school_users",
      "role='school_life' || role='accountant'",
      "",
      0,
      0,
    )) {
      user.set("role", "administrator");
      app.save(user);
    }
    users.fields.getByName("role").values = [
      "administrator",
      "teacher",
      "parent",
      "student",
    ];
    app.save(users);
  },
);
