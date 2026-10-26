const fields = {
  teaching_assignments: ["teacher", "classroom", "subject", "coefficient"],
  parent_links: ["parent", "student"],
  school_periods: ["year", "label", "starts_on", "ends_on"],
  evaluations: [
    "assignment",
    "period",
    "title",
    "held_on",
    "maximum",
    "weight",
    "published",
  ],
  school_grades: ["evaluation", "student", "score", "status", "comment"],
  homework: ["assignment", "title", "instructions", "due_on"],
  submissions: ["homework", "student", "answer", "feedback"],
  lesson_log: ["assignment", "held_on", "title", "content"],
  timetable_slots: ["assignment", "weekday", "start_time", "end_time", "room"],
  attendance: [
    "assignment",
    "student",
    "held_on",
    "status",
    "minutes",
    "justified",
    "note",
  ],
  absence_requests: ["attendance", "author", "reason", "status"],
  school_announcements: ["author", "title", "body", "audience"],
  school_messages: ["sender", "recipient", "subject", "body", "read"],
  payment_reversals: ["payment", "actor", "reason"],
  payment_deadlines: ["enrollment", "due_on", "amount", "label"],
  report_comments: ["period", "student", "comment"],
  school_audit: ["actor", "action", "entity", "record_id", "summary"],
};
function forbid(message = "Accès refusé.") {
  throw new ForbiddenError(message);
}
function bad(message) {
  throw new BadRequestError(message);
}
function text(v, name, max = 200) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    bad(name + " invalide.");
  return v.trim();
}
function number(v, name, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    bad(name + " invalide.");
  return v;
}
function day(v) {
  text(v, "Date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v + "T00:00:00Z")) ||
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
  )
    bad("Date invalide.");
  return v;
}
function time(v) {
  if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
    bad("Heure invalide.");
  return v;
}
function pack(r, keys) {
  const out = { id: r.id };
  for (const key of keys) out[key] = r.get(key);
  return out;
}
function all(app, name, school, keys) {
  return app
    .findRecordsByFilter(
      name,
      (name === "enrollments" ||
      name === "payments" ||
      name === "school_users" ||
      name === "classes" ||
      name === "academic_years" ||
      name === "subjects"
        ? "establishment_id"
        : "school") + " = {:school}",
      "",
      0,
      0,
      { school },
    )
    .map((r) => pack(r, keys));
}
function actor(app, auth) {
  const r = app.findRecordById("school_users", auth.id);
  if (r.getBool("disabled")) forbid("Compte désactivé.");
  return {
    id: r.id,
    school: r.getString("establishment_id"),
    role: r.getString("role"),
    record: r,
  };
}
function own(app, name, id, a) {
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id))
    bad("Identifiant invalide.");
  let r;
  try {
    r = app.findRecordById(name, id);
  } catch {
    throw new NotFoundError("Enregistrement introuvable.");
  }
  const key = [
    "school_users",
    "classes",
    "academic_years",
    "subjects",
    "enrollments",
    "payments",
  ].includes(name)
    ? "establishment_id"
    : "school";
  if (r.getString(key) !== a.school) forbid();
  return r;
}
function admin(a) {
  if (a.role !== "administrator") forbid();
}
function assignment(app, id, a) {
  const r = own(app, "teaching_assignments", id, a);
  if (
    a.role !== "administrator" &&
    (a.role !== "teacher" || r.getString("teacher") !== a.id)
  )
    forbid();
  return r;
}
function academicDate(app, as, value, a) {
  const date = day(value);
  const classroom = own(app, "classes", as.getString("classroom"), a);
  const year = own(
    app,
    "academic_years",
    classroom.getString("academic_year_id"),
    a,
  );
  if (
    date < year.getString("starts_on").slice(0, 10) ||
    date > year.getString("ends_on").slice(0, 10)
  )
    bad("Date hors de l’année scolaire de cette classe.");
  return date;
}
function enrolled(app, student, classroom, school) {
  return (
    app.findRecordsByFilter(
      "enrollments",
      "student_id={:student} && class_id={:classroom} && establishment_id={:school}",
      "",
      1,
      0,
      { student, classroom, school },
    ).length > 0
  );
}
function save(app, name, a, data, id) {
  const r = id
    ? own(app, name, id, a)
    : new Record(app.findCollectionByNameOrId(name));
  r.set("school", a.school);
  for (const k of fields[name])
    if (Object.prototype.hasOwnProperty.call(data, k)) r.set(k, data[k]);
  app.save(r);
  return r;
}
function log(app, a, action, entity, id, summary = "") {
  save(app, "school_audit", a, {
    actor: a.id,
    action,
    entity,
    record_id: id,
    summary: summary.slice(0, 2000),
  });
}
function state(app, auth) {
  const a = actor(app, auth),
    isAdmin = a.role === "administrator";
  const d = {};
  d.school = pack(app.findRecordById("establishments", a.school), [
    "name",
    "country",
    "city",
  ]);
  d.me = pack(a.record, [
    "first_name",
    "last_name",
    "role",
    "email",
    "phone",
    "login_id",
  ]);
  const users = all(app, "school_users", a.school, [
    "first_name",
    "last_name",
    "role",
    "disabled",
    ...(isAdmin ? ["email", "phone", "login_id"] : []),
  ]);
  d.years = all(app, "academic_years", a.school, [
    "label",
    "starts_on",
    "ends_on",
    "is_active",
  ]);
  const classes = all(app, "classes", a.school, [
    "name",
    "academic_year_id",
    "capacity",
  ]);
  let enrollments = all(app, "enrollments", a.school, [
    "student_id",
    "class_id",
    "academic_year_id",
    "enrolled_on",
    "registration_fee",
    "tuition_fee",
    "previous_classes",
  ]);
  const links = all(app, "parent_links", a.school, fields.parent_links);
  let assignments = all(
    app,
    "teaching_assignments",
    a.school,
    fields.teaching_assignments,
  );
  let students = [];
  if (a.role === "parent")
    students = links.filter((x) => x.parent === a.id).map((x) => x.student);
  if (a.role === "student") students = [a.id];
  if (a.role === "teacher")
    assignments = assignments.filter((x) => x.teacher === a.id);
  const classroomIds = isAdmin
    ? classes.map((x) => x.id)
    : a.role === "teacher"
      ? assignments.map((x) => x.classroom)
      : enrollments
          .filter((x) => students.includes(x.student_id))
          .flatMap((x) => [x.class_id, ...(x.previous_classes || [])]);
  if (a.role === "teacher")
    students = enrollments
      .filter((x) =>
        [x.class_id, ...(x.previous_classes || [])].some((c) =>
          classroomIds.includes(c),
        ),
      )
      .map((x) => x.student_id);
  if (!isAdmin)
    enrollments = enrollments.filter(
      (x) =>
        students.includes(x.student_id) &&
        (a.role !== "teacher" ||
          [x.class_id, ...(x.previous_classes || [])].some((c) =>
            classroomIds.includes(c),
          )),
    );
  if (!isAdmin && a.role !== "teacher")
    assignments = assignments.filter((x) => classroomIds.includes(x.classroom));
  d.classes = classes.filter((x) => classroomIds.includes(x.id));
  d.assignments = assignments;
  d.enrollments = enrollments;
  if (a.role === "teacher")
    d.enrollments = d.enrollments.map(
      ({ registration_fee, tuition_fee, ...x }) => x,
    );
  d.links = isAdmin
    ? links
    : links.filter((x) =>
        a.role === "parent"
          ? x.parent === a.id
          : a.role === "teacher"
            ? students.includes(x.student)
            : false,
      );
  const contactIds = [
    a.id,
    ...students,
    ...assignments.map((x) => x.teacher),
    ...d.links.map((x) => x.parent),
    ...users.filter((x) => x.role === "administrator").map((x) => x.id),
  ];
  d.people = isAdmin
    ? users
    : users
        .filter((x) => contactIds.includes(x.id) && !x.disabled)
        .map(({ disabled, ...x }) => x);
  const assignmentIds = assignments.map((x) => x.id);
  d.subjects = all(app, "subjects", a.school, ["name"]).filter(
    (x) => isAdmin || assignments.some((y) => y.subject === x.id),
  );
  d.periods = all(app, "school_periods", a.school, fields.school_periods);
  d.evaluations = all(app, "evaluations", a.school, fields.evaluations).filter(
    (x) =>
      (isAdmin || assignmentIds.includes(x.assignment)) &&
      (isAdmin || a.role === "teacher" || x.published),
  );
  d.grades = all(app, "school_grades", a.school, fields.school_grades).filter(
    (x) =>
      d.evaluations.some((y) => y.id === x.evaluation) &&
      (isAdmin || students.includes(x.student)),
  );
  for (const [name, key] of [
    ["homework", "homework"],
    ["lesson_log", "lessons"],
    ["timetable_slots", "timetable"],
    ["attendance", "attendance"],
  ])
    d[key] = all(app, name, a.school, fields[name]).filter(
      (x) =>
        (isAdmin || assignmentIds.includes(x.assignment)) &&
        (name !== "attendance" || isAdmin || students.includes(x.student)),
    );
  d.submissions = all(app, "submissions", a.school, fields.submissions).filter(
    (x) =>
      d.homework.some((y) => y.id === x.homework) &&
      (isAdmin || a.role === "teacher" || students.includes(x.student)),
  );
  d.absenceRequests = all(
    app,
    "absence_requests",
    a.school,
    fields.absence_requests,
  ).filter((x) => d.attendance.some((y) => y.id === x.attendance));
  d.announcements = all(
    app,
    "school_announcements",
    a.school,
    fields.school_announcements,
  ).filter((x) => isAdmin || x.audience === "all" || x.audience === a.role);
  d.messages = all(
    app,
    "school_messages",
    a.school,
    fields.school_messages,
  ).filter((x) => x.sender === a.id || x.recipient === a.id);
  const enrollmentIds = d.enrollments.map((x) => x.id);
  d.payments =
    a.role === "teacher"
      ? []
      : all(app, "payments", a.school, [
          "enrollment_id",
          "amount",
          "paid_on",
          "method",
          "reference",
          "recorded_by",
          "created",
        ]).filter((x) => enrollmentIds.includes(x.enrollment_id));
  const paymentIds = d.payments.map((x) => x.id);
  d.reversals = all(
    app,
    "payment_reversals",
    a.school,
    fields.payment_reversals,
  ).filter((x) => paymentIds.includes(x.payment));
  d.deadlines = all(
    app,
    "payment_deadlines",
    a.school,
    fields.payment_deadlines,
  ).filter((x) => a.role !== "teacher" && enrollmentIds.includes(x.enrollment));
  d.reportComments = all(
    app,
    "report_comments",
    a.school,
    fields.report_comments,
  ).filter((x) => isAdmin || students.includes(x.student));
  d.audit = isAdmin
    ? app
        .findRecordsByFilter(
          "school_audit",
          "school={:school}",
          "-created",
          200,
          0,
          { school: a.school },
        )
        .map((x) => pack(x, [...fields.school_audit, "created"]))
    : [];
  return d;
}
function action(app, auth, b) {
  const a = actor(app, auth);
  const op = text(b.operation, "Action", 60);
  const data = b.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    bad("Données invalides.");
  let result = {};
  app.runInTransaction((tx) => {
    switch (op) {
      case "edit-school": {
        admin(a);
        const r = tx.findRecordById("establishments", a.school);
        r.set("name", text(data.name, "Nom"));
        r.set("country", text(data.country, "Pays"));
        r.set(
          "city",
          typeof data.city === "string" ? data.city.slice(0, 200) : "",
        );
        tx.save(r);
        result = r;
        break;
      }
      case "edit-class": {
        admin(a);
        const r = own(tx, "classes", data.id, a);
        const capacity = number(data.capacity, "Capacité", 1, 1000);
        if (!Number.isInteger(capacity)) bad("Capacité entière requise.");
        const occupied = tx.findRecordsByFilter(
          "enrollments",
          "class_id={:id}",
          "",
          0,
          0,
          { id: r.id },
        ).length;
        if (capacity < occupied)
          bad("Capacité inférieure aux inscriptions existantes.");
        r.set("name", text(data.name, "Classe"));
        r.set("capacity", capacity);
        tx.save(r);
        result = r;
        break;
      }
      case "edit-subject": {
        admin(a);
        const r = own(tx, "subjects", data.id, a);
        r.set("name", text(data.name, "Matière"));
        tx.save(r);
        result = r;
        break;
      }
      case "edit-person": {
        admin(a);
        const r = own(tx, "school_users", data.user, a);
        r.set("first_name", text(data.first_name, "Prénom"));
        r.set("last_name", text(data.last_name, "Nom"));
        r.set(
          "phone",
          typeof data.phone === "string" ? data.phone.slice(0, 40) : "",
        );
        tx.save(r);
        result = r;
        break;
      }
      case "import-students": {
        admin(a);
        const classroom = own(tx, "classes", data.classroom, a);
        const rows = require(__hooks + "/csv-import.cjs")(data.csv);
        const registration = number(
            data.registration_fee,
            "Frais",
            0,
            1000000000,
          ),
          tuition = number(data.tuition_fee, "Scolarité", 0, 1000000000);
        if (!Number.isInteger(registration) || !Number.isInteger(tuition))
          bad("Montants entiers requis.");
        const date = day(data.enrolled_on),
          credentials = [];
        for (const row of rows) {
          const password = $security.randomString(12),
            r = new Record(tx.findCollectionByNameOrId("school_users"));
          r.set("first_name", text(row.first_name, "Prénom"));
          r.set("last_name", text(row.last_name, "Nom"));
          r.set("email", row.email.trim());
          r.set("emailVisibility", true);
          r.set("phone", row.phone.slice(0, 40));
          r.set("role", "student");
          r.set("establishment_id", a.school);
          r.set("password", password);
          tx.save(r);
          const en = new Record(tx.findCollectionByNameOrId("enrollments"));
          for (const [k, v] of Object.entries({
            establishment_id: a.school,
            student_id: r.id,
            academic_year_id: classroom.getString("academic_year_id"),
            class_id: classroom.id,
            enrolled_on: date,
            registration_fee: registration,
            tuition_fee: tuition,
          }))
            en.set(k, v);
          tx.save(en);
          credentials.push({
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            login_id: r.getString("login_id"),
            password,
          });
        }
        result = { id: "import-" + rows.length, credentials };
        break;
      }
      case "assignment": {
        admin(a);
        const t = own(tx, "school_users", data.teacher, a),
          c = own(tx, "classes", data.classroom, a);
        own(tx, "subjects", data.subject, a);
        if (t.getString("role") !== "teacher" || t.getBool("disabled"))
          bad("Enseignant invalide.");
        result = save(tx, "teaching_assignments", a, {
          teacher: t.id,
          classroom: c.id,
          subject: data.subject,
          coefficient: number(data.coefficient, "Coefficient", 0.1, 20),
        });
        break;
      }
      case "parent-link": {
        admin(a);
        const p = own(tx, "school_users", data.parent, a),
          s = own(tx, "school_users", data.student, a);
        if (
          p.getString("role") !== "parent" ||
          s.getString("role") !== "student"
        )
          bad("Rôles parent/élève invalides.");
        result = save(tx, "parent_links", a, { parent: p.id, student: s.id });
        break;
      }
      case "period": {
        admin(a);
        const year = own(tx, "academic_years", data.year, a);
        const start = day(data.starts_on),
          end = day(data.ends_on);
        if (
          start > end ||
          start < year.getString("starts_on").slice(0, 10) ||
          end > year.getString("ends_on").slice(0, 10)
        )
          bad("Période hors de l’année scolaire.");
        result = save(tx, "school_periods", a, {
          year: year.id,
          label: text(data.label, "Libellé"),
          starts_on: start,
          ends_on: end,
        });
        break;
      }
      case "evaluation": {
        const as = assignment(tx, data.assignment, a),
          period = own(tx, "school_periods", data.period, a),
          c = own(tx, "classes", as.getString("classroom"), a);
        if (period.getString("year") !== c.getString("academic_year_id"))
          bad("Période d’une autre année.");
        const held = day(data.held_on);
        if (
          held < period.getString("starts_on") ||
          held > period.getString("ends_on")
        )
          bad("Évaluation hors période.");
        result = save(tx, "evaluations", a, {
          assignment: as.id,
          period: period.id,
          title: text(data.title, "Titre"),
          held_on: held,
          maximum: number(data.maximum, "Barème", 1, 1000),
          weight: number(data.weight, "Coefficient", 0.1, 20),
          published: false,
        });
        break;
      }
      case "publish-evaluation": {
        const ev = own(tx, "evaluations", data.id, a);
        assignment(tx, ev.getString("assignment"), a);
        if (typeof data.published !== "boolean") bad("État invalide.");
        result = save(
          tx,
          "evaluations",
          a,
          { published: data.published },
          ev.id,
        );
        break;
      }
      case "grade": {
        const ev = own(tx, "evaluations", data.evaluation, a),
          as = assignment(tx, ev.getString("assignment"), a),
          student = own(tx, "school_users", data.student, a);
        if (
          student.getString("role") !== "student" ||
          !enrolled(tx, student.id, as.getString("classroom"), a.school)
        )
          bad("Élève non inscrit dans cette classe.");
        if (!["graded", "absent", "exempt"].includes(data.status))
          bad("Statut invalide.");
        const score =
          data.status === "graded"
            ? number(data.score, "Note", 0, ev.getFloat("maximum"))
            : 0;
        const previous = tx.findRecordsByFilter(
          "school_grades",
          "evaluation={:ev} && student={:student}",
          "",
          1,
          0,
          { ev: ev.id, student: student.id },
        );
        result = save(
          tx,
          "school_grades",
          a,
          {
            evaluation: ev.id,
            student: student.id,
            score,
            status: data.status,
            comment:
              typeof data.comment === "string"
                ? data.comment.slice(0, 1000)
                : "",
          },
          previous[0]?.id,
        );
        break;
      }
      case "homework":
      case "lesson": {
        const as = assignment(tx, data.assignment, a);
        if (op === "homework")
          result = save(tx, "homework", a, {
            assignment: as.id,
            title: text(data.title, "Titre"),
            instructions: text(data.instructions, "Consignes", 10000),
            due_on: academicDate(tx, as, data.due_on, a),
          });
        else
          result = save(tx, "lesson_log", a, {
            assignment: as.id,
            title: text(data.title, "Titre"),
            content: text(data.content, "Contenu", 10000),
            held_on: academicDate(tx, as, data.held_on, a),
          });
        break;
      }
      case "submission": {
        if (a.role !== "student") forbid();
        const hw = own(tx, "homework", data.homework, a),
          as = own(tx, "teaching_assignments", hw.getString("assignment"), a);
        if (!enrolled(tx, a.id, as.getString("classroom"), a.school)) forbid();
        const old = tx.findRecordsByFilter(
          "submissions",
          "homework={:hw} && student={:student}",
          "",
          1,
          0,
          { hw: hw.id, student: a.id },
        );
        result = save(
          tx,
          "submissions",
          a,
          {
            homework: hw.id,
            student: a.id,
            answer: text(data.answer, "Réponse", 20000),
          },
          old[0]?.id,
        );
        break;
      }
      case "feedback": {
        const sub = own(tx, "submissions", data.id, a),
          hw = own(tx, "homework", sub.getString("homework"), a);
        assignment(tx, hw.getString("assignment"), a);
        result = save(
          tx,
          "submissions",
          a,
          { feedback: text(data.feedback, "Correction", 4000) },
          sub.id,
        );
        break;
      }
      case "timetable": {
        admin(a);
        const as = own(tx, "teaching_assignments", data.assignment, a),
          weekday = number(data.weekday, "Jour", 1, 7);
        if (!Number.isInteger(weekday)) bad("Jour invalide.");
        const start = time(data.start_time),
          end = time(data.end_time);
        if (start >= end) bad("Heures invalides.");
        const room =
          typeof data.room === "string" ? data.room.trim().slice(0, 100) : "";
        const slots = tx.findRecordsByFilter(
          "timetable_slots",
          "school={:school} && weekday={:weekday}",
          "",
          0,
          0,
          { school: a.school, weekday },
        );
        for (const slot of slots) {
          const other = own(
            tx,
            "teaching_assignments",
            slot.getString("assignment"),
            a,
          );
          const c = own(tx, "classes", as.getString("classroom"), a),
            oc = own(tx, "classes", other.getString("classroom"), a);
          if (
            c.getString("academic_year_id") ===
              oc.getString("academic_year_id") &&
            start < slot.getString("end_time") &&
            end > slot.getString("start_time") &&
            (as.getString("teacher") === other.getString("teacher") ||
              as.getString("classroom") === other.getString("classroom") ||
              (room &&
                room.toLowerCase() ===
                  slot.getString("room").trim().toLowerCase()))
          )
            bad("Conflit de classe, enseignant ou salle.");
        }
        result = save(tx, "timetable_slots", a, {
          assignment: as.id,
          weekday,
          start_time: start,
          end_time: end,
          room,
        });
        break;
      }
      case "attendance": {
        const as = assignment(tx, data.assignment, a),
          student = own(tx, "school_users", data.student, a);
        if (!enrolled(tx, student.id, as.getString("classroom"), a.school))
          bad("Élève hors classe.");
        if (!["present", "absent", "late"].includes(data.status))
          bad("Statut invalide.");
        const date = academicDate(tx, as, data.held_on, a);
        const old = tx.findRecordsByFilter(
          "attendance",
          "assignment={:as} && student={:student} && held_on={:date}",
          "",
          1,
          0,
          { as: as.id, student: student.id, date },
        );
        result = save(
          tx,
          "attendance",
          a,
          {
            assignment: as.id,
            student: student.id,
            held_on: date,
            status: data.status,
            minutes:
              data.status === "late"
                ? number(data.minutes, "Retard", 1, 600)
                : 0,
            note: typeof data.note === "string" ? data.note.slice(0, 2000) : "",
            ...(old.length ? {} : { justified: false }),
          },
          old[0]?.id,
        );
        break;
      }
      case "absence-request": {
        if (!["student", "parent"].includes(a.role)) forbid();
        const at = own(tx, "attendance", data.attendance, a);
        if (at.getString("status") === "present")
          bad("Aucune absence à justifier.");
        if (a.role === "student" && at.getString("student") !== a.id) forbid();
        if (
          a.role === "parent" &&
          !tx.findRecordsByFilter(
            "parent_links",
            "parent={:parent} && student={:student}",
            "",
            1,
            0,
            { parent: a.id, student: at.getString("student") },
          ).length
        )
          forbid();
        result = save(tx, "absence_requests", a, {
          attendance: at.id,
          author: a.id,
          reason: text(data.reason, "Motif", 4000),
          status: "pending",
        });
        break;
      }
      case "absence-review": {
        admin(a);
        const request = own(tx, "absence_requests", data.id, a),
          at = own(tx, "attendance", request.getString("attendance"), a);
        if (!["accepted", "rejected"].includes(data.status))
          bad("Décision invalide.");
        result = save(
          tx,
          "absence_requests",
          a,
          { status: data.status },
          request.id,
        );
        save(
          tx,
          "attendance",
          a,
          { justified: data.status === "accepted" },
          at.id,
        );
        break;
      }
      case "announcement": {
        admin(a);
        if (!["all", "student", "parent", "teacher"].includes(data.audience))
          bad("Destinataires invalides.");
        result = save(tx, "school_announcements", a, {
          author: a.id,
          title: text(data.title, "Titre"),
          body: text(data.body, "Message", 10000),
          audience: data.audience,
        });
        break;
      }
      case "message": {
        const visible = state(tx, auth),
          recipient = own(tx, "school_users", data.recipient, a);
        if (
          recipient.getBool("disabled") ||
          recipient.id === a.id ||
          !visible.people.some((x) => x.id === recipient.id)
        )
          forbid();
        if (
          ["student", "parent"].includes(a.role) &&
          !["teacher", "administrator"].includes(recipient.getString("role"))
        )
          forbid();
        result = save(tx, "school_messages", a, {
          sender: a.id,
          recipient: recipient.id,
          subject: text(data.subject, "Objet"),
          body: text(data.body, "Message", 10000),
          read: false,
        });
        break;
      }
      case "message-read": {
        const m = own(tx, "school_messages", data.id, a);
        if (m.getString("recipient") !== a.id) forbid();
        result = save(tx, "school_messages", a, { read: true }, m.id);
        break;
      }
      case "report-comment": {
        admin(a);
        const period = own(tx, "school_periods", data.period, a),
          student = own(tx, "school_users", data.student, a);
        if (
          student.getString("role") !== "student" ||
          !tx.findRecordsByFilter(
            "enrollments",
            "student_id={:s} && academic_year_id={:y}",
            "",
            1,
            0,
            { s: student.id, y: period.getString("year") },
          ).length
        )
          bad("Élève non inscrit pour cette période.");
        const old = tx.findRecordsByFilter(
          "report_comments",
          "period={:p} && student={:s}",
          "",
          1,
          0,
          { p: period.id, s: student.id },
        );
        result = save(
          tx,
          "report_comments",
          a,
          {
            period: period.id,
            student: student.id,
            comment: text(data.comment, "Appréciation", 4000),
          },
          old[0]?.id,
        );
        break;
      }
      case "deadline": {
        admin(a);
        const en = own(tx, "enrollments", data.enrollment, a);
        const amount = number(data.amount, "Montant", 1, 2000000000);
        if (!Number.isInteger(amount)) bad("Montant entier requis.");
        const total = new DynamicModel({ total: 0 });
        tx.db()
          .newQuery(
            "SELECT COALESCE(SUM(amount),0) total FROM payment_deadlines WHERE enrollment={:id}",
          )
          .bind({ id: en.id })
          .one(total);
        if (
          total.total + amount >
          en.getFloat("registration_fee") + en.getFloat("tuition_fee")
        )
          bad("Échéancier supérieur aux frais.");
        result = save(tx, "payment_deadlines", a, {
          enrollment: en.id,
          amount,
          due_on: day(data.due_on),
          label: text(data.label, "Libellé"),
        });
        break;
      }
      case "reverse-payment": {
        admin(a);
        const p = own(tx, "payments", data.payment, a);
        result = save(tx, "payment_reversals", a, {
          payment: p.id,
          actor: a.id,
          reason: text(data.reason, "Motif", 2000),
        });
        break;
      }
      case "reset-password": {
        admin(a);
        const u = own(tx, "school_users", data.user, a);
        const password = text(data.password, "Mot de passe", 200);
        if (password.length < 8) bad("Au moins 8 caractères.");
        u.set("password", password);
        tx.save(u);
        result = u;
        break;
      }
      case "change-password": {
        const old = text(data.current_password, "Mot de passe actuel", 200),
          next = text(data.password, "Nouveau mot de passe", 200);
        if (!a.record.validatePassword(old))
          bad("Mot de passe actuel incorrect.");
        if (next.length < 8) bad("Au moins 8 caractères.");
        a.record.set("password", next);
        tx.save(a.record);
        result = a.record;
        break;
      }
      case "disable-user": {
        admin(a);
        const u = own(tx, "school_users", data.user, a);
        if (u.id === a.id) bad("Impossible de désactiver votre propre compte.");
        if (typeof data.disabled !== "boolean") bad("État invalide.");
        u.set("disabled", data.disabled);
        tx.save(u);
        result = u;
        break;
      }
      case "activate-year": {
        admin(a);
        const y = own(tx, "academic_years", data.year, a);
        for (const old of tx.findRecordsByFilter(
          "academic_years",
          "establishment_id={:s} && is_active=true",
          "",
          0,
          0,
          { s: a.school },
        )) {
          old.set("is_active", false);
          tx.save(old);
        }
        y.set("is_active", true);
        tx.save(y);
        result = y;
        break;
      }
      case "delete-item": {
        admin(a);
        if (
          ![
            "timetable_slots",
            "teaching_assignments",
            "parent_links",
            "school_periods",
            "homework",
            "lesson_log",
            "payment_deadlines",
          ].includes(data.entity)
        )
          forbid();
        const r = own(tx, data.entity, data.id, a);
        tx.delete(r);
        result = { id: data.id };
        break;
      }
      default:
        bad("Action inconnue.");
    }
    if (op !== "message-read")
      log(
        tx,
        a,
        op,
        op,
        result.id || "",
        op === "reverse-payment" ? text(data.reason, "Motif", 2000) : "",
      );
  });
  return {
    saved: true,
    id: result.id,
    ...(op === "import-students" ? { credentials: result.credentials } : {}),
  };
}
module.exports = { state, action };
