// Used only by the explicitly invoked capacity benchmark's temporary migration.
exports.seed = function (app, config) {
  if (app.findAllRecords('establishments').length) throw Error('Capacity seed requires an empty isolated database');
  if (!config || typeof config.password !== 'string' || config.password.length < 24) throw Error('Capacity seed requires a generated password');
  const manifest = [];
  app.runInTransaction((tx) => {
    const collections = {};
    const save = (name, values) => {
      const c = collections[name] || (collections[name] = tx.findCollectionByNameOrId(name));
      const r = new Record(c);
      for (const key of Object.keys(values)) {
        if (key === 'password') r.setPassword(values[key]);
        else r.set(key, values[key]);
      }
      tx.save(r);
      return r;
    };
    for (let n = 1; n <= 2; n++) {
      const school = save('establishments', { name: 'Capacity fictive ' + n, country: 'Burkina Faso', city: 'Fixture' });
      const person = (role, index) => save('school_users', { establishment_id: school.id, role, first_name: role + index, last_name: 'Capacity' + n, login_id: 'CAP' + n + role + index, email: 'school' + n + '.' + role + index + '@capacity.invalid', password: config.password });
      const admin = person('administrator', 0), teachers = Array.from({ length: 10 }, (_, i) => person('teacher', i));
      const year = save('academic_years', { establishment_id: school.id, label: '2026-2027', starts_on: '2026-09-01 00:00:00Z', ends_on: '2027-07-31 00:00:00Z', is_active: true });
      const period = save('school_periods', { school: school.id, year: year.id, label: 'Trimestre 1', starts_on: '2026-09-01', ends_on: '2026-12-31' });
      const seededSubjects = tx.findRecordsByFilter('subjects', 'establishment_id={:school}', '', 0, 0, { school: school.id });
      const subjects = seededSubjects.slice(0, 10);
      for (const extra of seededSubjects.slice(10)) tx.delete(extra);
      while (subjects.length < 10) subjects.push(save('subjects', { establishment_id: school.id, name: 'Capacity subject ' + (subjects.length + 1) }));
      const students = [], enrollments = [], assignments = [], classes = [];
      for (let c = 0; c < 40; c++) {
        const classroom = save('classes', { establishment_id: school.id, academic_year_id: year.id, name: 'Classe ' + (c + 1), capacity: 40 });
        classes.push(classroom.id);
        const roster = [];
        for (let i = 0; i < 40; i++) {
          const index = c * 40 + i, student = person('student', index);
          const enrollment = save('enrollments', { establishment_id: school.id, student_id: student.id, academic_year_id: year.id, class_id: classroom.id, enrolled_on: '2026-09-01', registration_fee: 10000, tuition_fee: 100000 });
          save('payments', { establishment_id: school.id, enrollment_id: enrollment.id, recorded_by: admin.id, amount: 10000, paid_on: '2026-09-02', method: 'cash', request_key: 'capacity-' + n + '-' + index });
          roster.push(student); students.push(student.id); enrollments.push(enrollment.id);
        }
        for (let m = 0; m < 10; m++) {
          const assignment = save('teaching_assignments', { school: school.id, teacher: teachers[m].id, classroom: classroom.id, subject: subjects[m].id, coefficient: 1 + m % 3 });
          assignments.push(assignment.id);
          for (let e = 0; e < 3; e++) {
            const evaluation = save('evaluations', { school: school.id, assignment: assignment.id, period: period.id, title: 'Contrôle ' + (e + 1), held_on: '2026-10-' + (10 + e), maximum: 20, weight: 1, published: true });
            for (let i = 0; i < roster.length; i++) save('school_grades', { school: school.id, evaluation: evaluation.id, student: roster[i].id, score: 5 + (i + e + m) % 16, status: 'graded', comment: 'Résultat fictif de capacité' });
          }
          if (m === 0) for (const student of roster) save('attendance', { school: school.id, assignment: assignment.id, student: student.id, held_on: '2026-10-14', status: 'absent', minutes: 0, justified: false, note: 'Absence fictive' });
        }
      }
      manifest.push({ allStudents: students, allClasses: classes, allSubjects: subjects.map(x => x.id), allTeachers: teachers.map(x => x.id), allEnrollments: enrollments, allAssignments: assignments, school: school.id, admin: admin.id, teacher: teachers[0].id, students: students.slice(0, 10), enrollments: enrollments.slice(0, 10), assignment: assignments[0], emails: { admin: 'school' + n + '.administrator0@capacity.invalid', teacher: 'school' + n + '.teacher0@capacity.invalid', students: Array.from({ length: 10 }, (_, i) => 'school' + n + '.student' + i + '@capacity.invalid') } });
    }
    tx.save(new Collection({ name: 'capacity_manifest', type: 'base', fields: [{ name: 'payload', type: 'json' }], listRule: null, viewRule: null }));
    save('capacity_manifest', { payload: manifest });
  });
};
