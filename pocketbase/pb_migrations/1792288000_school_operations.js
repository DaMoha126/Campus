migrate(
  (app) => {
    const rel = (name, target, required = true) => ({
      name,
      type: "relation",
      collectionId: app.findCollectionByNameOrId(target).id,
      required,
      maxSelect: 1,
      cascadeDelete: false,
    });
    const txt = (name, max = 200, required = true) => ({
      name,
      type: "text",
      max,
      required,
    });
    const num = (name, min, max) => ({
      name,
      type: "number",
      min,
      max,
      onlyInt: true,
    });
    const sel = (name, values) => ({
      name,
      type: "select",
      required: true,
      maxSelect: 1,
      values,
    });
    const enrollment = app.findCollectionByNameOrId("enrollments");
    enrollment.fields.add(
      new RelationField({
        name: "previous_classes",
        collectionId: app.findCollectionByNameOrId("classes").id,
        maxSelect: 100,
        cascadeDelete: false,
      }),
    );
    app.save(enrollment);
    const users = app.findCollectionByNameOrId("school_users");
    users.fields.add(new BoolField({ name: "disabled" }));
    users.fields.add(new TextField({ name: "phone", max: 40 }));
    users.authRule = "disabled = false";
    app.save(users);
    for (const name of [
      "establishments",
      "school_users",
      "academic_years",
      "classes",
      "subjects",
      "enrollments",
      "payments",
    ]) {
      const c = app.findCollectionByNameOrId(name);
      for (const key of ["listRule", "viewRule", "createRule", "updateRule"])
        if (c[key])
          c[key] = "@request.auth.disabled = false && (" + c[key] + ")";
      app.save(c);
    }
    const create = (name, fields, indexes = []) => {
      app.save(
        new Collection({
          name,
          type: "base",
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
          fields: [
            rel("school", "establishments"),
            ...fields,
            { name: "created", type: "autodate", onCreate: true },
            {
              name: "updated",
              type: "autodate",
              onCreate: true,
              onUpdate: true,
            },
          ],
          indexes: indexes.some((x) => x.endsWith("(school)"))
            ? indexes
            : [
                ...indexes,
                `CREATE INDEX idx_${name}_school ON ${name}(school)`,
              ],
        }),
      );
    };
    create(
      "teaching_assignments",
      [
        rel("teacher", "school_users"),
        rel("classroom", "classes"),
        rel("subject", "subjects"),
        {
          name: "coefficient",
          type: "number",
          required: true,
          min: 0.1,
          max: 20,
        },
      ],
      [
        "CREATE UNIQUE INDEX idx_assignment_unique ON teaching_assignments(classroom,subject)",
        "CREATE INDEX idx_assignment_school ON teaching_assignments(school)",
      ],
    );
    create(
      "parent_links",
      [rel("parent", "school_users"), rel("student", "school_users")],
      [
        "CREATE UNIQUE INDEX idx_parent_student ON parent_links(parent,student)",
      ],
    );
    create(
      "school_periods",
      [
        rel("year", "academic_years"),
        txt("label"),
        txt("starts_on", 10),
        txt("ends_on", 10),
      ],
      ["CREATE UNIQUE INDEX idx_period_label ON school_periods(year,label)"],
    );
    create("evaluations", [
      rel("assignment", "teaching_assignments"),
      rel("period", "school_periods"),
      txt("title"),
      txt("held_on", 10),
      { name: "maximum", type: "number", required: true, min: 1, max: 1000 },
      { name: "weight", type: "number", required: true, min: 0.1, max: 20 },
      { name: "published", type: "bool" },
    ]);
    create(
      "school_grades",
      [
        rel("evaluation", "evaluations"),
        rel("student", "school_users"),
        { name: "score", type: "number", min: 0, max: 1000 },
        sel("status", ["graded", "absent", "exempt"]),
        txt("comment", 1000, false),
      ],
      [
        "CREATE UNIQUE INDEX idx_grade_student ON school_grades(evaluation,student)",
      ],
    );
    create("homework", [
      rel("assignment", "teaching_assignments"),
      txt("title"),
      txt("instructions", 10000),
      txt("due_on", 10),
    ]);
    create(
      "submissions",
      [
        rel("homework", "homework"),
        rel("student", "school_users"),
        txt("answer", 20000),
        txt("feedback", 4000, false),
      ],
      [
        "CREATE UNIQUE INDEX idx_homework_student ON submissions(homework,student)",
      ],
    );
    create("lesson_log", [
      rel("assignment", "teaching_assignments"),
      txt("held_on", 10),
      txt("title"),
      txt("content", 10000),
    ]);
    create("timetable_slots", [
      rel("assignment", "teaching_assignments"),
      num("weekday", 1, 7),
      txt("start_time", 5),
      txt("end_time", 5),
      txt("room", 100, false),
    ]);
    create(
      "attendance",
      [
        rel("assignment", "teaching_assignments"),
        rel("student", "school_users"),
        txt("held_on", 10),
        sel("status", ["present", "absent", "late"]),
        num("minutes", 0, 600),
        { name: "justified", type: "bool" },
        txt("note", 2000, false),
      ],
      [
        "CREATE UNIQUE INDEX idx_attendance_student_day ON attendance(assignment,student,held_on)",
      ],
    );
    create(
      "absence_requests",
      [
        rel("attendance", "attendance"),
        rel("author", "school_users"),
        txt("reason", 4000),
        sel("status", ["pending", "accepted", "rejected"]),
      ],
      [
        "CREATE UNIQUE INDEX idx_absence_author ON absence_requests(attendance,author)",
      ],
    );
    create("school_announcements", [
      rel("author", "school_users"),
      txt("title"),
      txt("body", 10000),
      sel("audience", ["all", "teacher", "parent", "student"]),
    ]);
    create("school_messages", [
      rel("sender", "school_users"),
      rel("recipient", "school_users"),
      txt("subject"),
      txt("body", 10000),
      { name: "read", type: "bool" },
    ]);
    create(
      "payment_reversals",
      [
        rel("payment", "payments"),
        rel("actor", "school_users"),
        txt("reason", 2000),
      ],
      [
        "CREATE UNIQUE INDEX idx_reversal_payment ON payment_reversals(payment)",
      ],
    );
    create("payment_deadlines", [
      rel("enrollment", "enrollments"),
      txt("due_on", 10),
      num("amount", 1, 2000000000),
      txt("label"),
    ]);
    create(
      "report_comments",
      [
        rel("period", "school_periods"),
        rel("student", "school_users"),
        txt("comment", 4000),
      ],
      [
        "CREATE UNIQUE INDEX idx_report_comment ON report_comments(period,student)",
      ],
    );
    create("school_audit", [
      rel("actor", "school_users"),
      txt("action"),
      txt("entity"),
      txt("record_id", 100),
      txt("summary", 2000, false),
    ]);
  },
  (app) => {
    for (const name of [
      "school_audit",
      "report_comments",
      "payment_deadlines",
      "payment_reversals",
      "school_messages",
      "school_announcements",
      "absence_requests",
      "attendance",
      "timetable_slots",
      "lesson_log",
      "submissions",
      "homework",
      "school_grades",
      "evaluations",
      "school_periods",
      "parent_links",
      "teaching_assignments",
    ])
      app.delete(app.findCollectionByNameOrId(name));
  },
);
