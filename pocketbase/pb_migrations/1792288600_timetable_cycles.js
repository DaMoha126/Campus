migrate(
  (app) => {
    const slots = app.findCollectionByNameOrId("timetable_slots");
    slots.fields.add(
      new SelectField({
        name: "week_type",
        maxSelect: 1,
        values: ["all", "odd", "even"],
      }),
    );
    slots.fields.add(new TextField({ name: "valid_from", max: 10 }));
    slots.fields.add(new TextField({ name: "valid_until", max: 10 }));
    app.save(slots);
    for (const record of app.findAllRecords("timetable_slots")) {
      record.set("week_type", "all");
      record.set("valid_from", "");
      record.set("valid_until", "");
      app.save(record);
    }
  },
  (app) => {
    const slots = app.findCollectionByNameOrId("timetable_slots");
    slots.fields.removeByName("valid_until");
    slots.fields.removeByName("valid_from");
    slots.fields.removeByName("week_type");
    app.save(slots);
  },
);
