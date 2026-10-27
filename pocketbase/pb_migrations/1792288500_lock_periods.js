migrate(
  (app) => {
    const periods = app.findCollectionByNameOrId("school_periods");
    periods.fields.add(new BoolField({ name: "locked" }));
    app.save(periods);
  },
  (app) => {
    const periods = app.findCollectionByNameOrId("school_periods");
    periods.fields.removeByName("locked");
    app.save(periods);
  },
);
