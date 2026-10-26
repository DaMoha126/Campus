function seed(app, password) {
  if (typeof password !== "string" || password.length < 12)
    throw new Error("A demo password of at least 12 characters is required.");
  // Never inject fictitious pupils into an existing school's database.
  if (app.findAllRecords("establishments").length) return;
  app.runInTransaction((tx) => {
    const save = (name, fields) => {
      const record = new Record(tx.findCollectionByNameOrId(name));
      for (const key of Object.keys(fields)) {
        if (key === "password") record.setPassword(fields[key]);
        else if (key !== "passwordConfirm") record.set(key, fields[key]);
      }
      tx.save(record);
      return record;
    };
    const school = save("establishments", {
      name: "École Démonstration — données fictives",
      country: "Burkina Faso", city: "Ouagadougou",
    });
    const person = (role, first_name, last_name, login_id) => save("school_users", {
      establishment_id: school.id, role, first_name, last_name, login_id,
      email: role + "@demo.invalid", emailVisibility: true,
      password, passwordConfirm: password,
    });
    const admin = person("administrator", "Administration", "Démo", "DEMOADMIN");
    const teacher = person("teacher", "Enseignant", "Démo", "DEMOPROF");
    const student = person("student", "Élève", "Démo", "DEMOELEVE");
    const parent = person("parent", "Parent", "Démo", "DEMOPARENT");
    const year = save("academic_years", {
      establishment_id: school.id, label: "2026–2027",
      starts_on: "2026-09-01 00:00:00Z", ends_on: "2027-07-31 00:00:00Z", is_active: true,
    });
    const classroom = save("classes", {
      establishment_id: school.id, academic_year_id: year.id, name: "3e A", capacity: 30,
    });
    const enrollment = save("enrollments", {
      establishment_id: school.id, academic_year_id: year.id, class_id: classroom.id,
      student_id: student.id, enrolled_on: "2026-10-01", registration_fee: 10000, tuition_fee: 90000,
    });
    const subject = tx.findFirstRecordByFilter("subjects", "establishment_id={:school} && name={:name}", {
      school: school.id, name: "Mathématiques",
    });
    const common = { school: school.id };
    const assignment = save("teaching_assignments", {
      ...common, teacher: teacher.id, classroom: classroom.id, subject: subject.id, coefficient: 2,
    });
    save("parent_links", { ...common, parent: parent.id, student: student.id });
    const period = save("school_periods", {
      ...common, year: year.id, label: "Trimestre 1", starts_on: "2026-09-01", ends_on: "2026-12-31",
    });
    const evaluation = save("evaluations", {
      ...common, assignment: assignment.id, period: period.id, title: "Contrôle de démonstration",
      held_on: "2026-10-20", maximum: 20, weight: 1, published: true,
    });
    save("school_grades", {
      ...common, evaluation: evaluation.id, student: student.id, score: 16, status: "graded", comment: "Bon travail — exemple fictif.",
    });
    save("timetable_slots", {
      ...common, assignment: assignment.id, weekday: 1, start_time: "08:00", end_time: "09:00", room: "Salle A",
    });
    save("homework", {
      ...common, assignment: assignment.id, title: "Exercice de démonstration",
      instructions: "Résoudre 2x = 6.", due_on: "2026-11-02",
    });
    save("school_announcements", {
      ...common, author: admin.id, title: "Bienvenue dans la démo gratuite",
      body: "Toutes les données sont fictives. Ne saisissez aucune donnée réelle. Les modifications peuvent être perdues à tout redémarrage ou mise en veille.", audience: "all",
    });
    save("payment_deadlines", {
      ...common, enrollment: enrollment.id, due_on: "2026-11-15", amount: 50000, label: "Échéance fictive",
    });
  });
}
module.exports = { seed };
