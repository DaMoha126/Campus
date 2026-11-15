// Aggregate classmates' results inside SQLite. Only the requested pupils' rank
// and class size cross the database boundary; no classmates' grades are packed.
function reportRanks(app, options) {
  const { school, students, enrollments, periods, assignments, evaluations, academicClassIds } = options;
  const ownStudents = new Set(students);
  const allowedClasses = new Set(assignments
    .filter(x => academicClassIds === null || academicClassIds.includes(x.classroom))
    .map(x => x.classroom));
  const groups = new Map();
  for (const enrollment of enrollments) {
    if (!ownStudents.has(enrollment.student_id) || !allowedClasses.has(enrollment.class_id)) continue;
    const key = enrollment.class_id + ":" + enrollment.academic_year_id;
    if (!groups.has(key)) groups.set(key, { classroom: enrollment.class_id, year: enrollment.academic_year_id, students: new Set() });
    groups.get(key).students.add(enrollment.student_id);
  }
  const ranks = new Map();
  const assignmentClass = new Map(assignments.map(a => [a.id, a.classroom]));
  for (const [groupKey, group] of groups) {
    const selectedPeriods = periods.filter(p => p.year === group.year);
    if (!selectedPeriods.length) continue;
    const periodIds = new Set(selectedPeriods.map(p => p.id));
    const evaluationIds = evaluations.filter(e => assignmentClass.get(e.assignment) === group.classroom && periodIds.has(e.period)).map(e => e.id);
    if (!evaluationIds.length) continue;
    const params = { school, classroom: group.classroom, year: group.year,
      evaluations: JSON.stringify(evaluationIds), students: JSON.stringify([...group.students]) };
    const rows = arrayOf(new DynamicModel({ student: "", period: "", rank: 0, class_size: 0 }));
    app.db().newQuery(`
      WITH assignment_results AS (
        SELECT g.student, e.period, a.id AS assignment,
          a.coefficient,
          SUM((g.score * 1.0 / e.maximum) * 20.0 * e.weight) / SUM(e.weight) AS average
        FROM teaching_assignments a
        JOIN classes c ON c.id = a.classroom
          AND c.establishment_id = {:school} AND c.academic_year_id = {:year}
        JOIN evaluations e ON e.assignment = a.id AND e.school = {:school}
        JOIN school_periods p ON p.id = e.period AND p.school = {:school} AND p.year = {:year}
        JOIN school_grades g ON g.evaluation = e.id AND g.school = {:school}
        JOIN enrollments roster ON roster.student_id = g.student
          AND roster.establishment_id = {:school}
          AND roster.class_id = {:classroom} AND roster.academic_year_id = {:year}
        JOIN school_users pupil ON pupil.id = g.student AND pupil.establishment_id = {:school}
        WHERE a.school = {:school} AND a.classroom = {:classroom}
          AND e.published = 1 AND g.status = 'graded'
          AND e.id IN (SELECT value FROM json_each({:evaluations}))
        GROUP BY g.student, e.period, a.id, a.coefficient
        HAVING SUM(e.weight) > 0
      ), averages AS (
        SELECT student, period,
          SUM(average * coefficient) / SUM(coefficient) AS average
        FROM assignment_results GROUP BY student, period HAVING SUM(coefficient) > 0
      )
      SELECT own.student, own.period,
        1 + (SELECT COUNT(*) FROM averages peer
          WHERE peer.period = own.period AND peer.average > own.average + 0.000000001) AS rank,
        (SELECT COUNT(*) FROM averages peer WHERE peer.period = own.period) AS class_size
      FROM averages own WHERE own.student IN (SELECT value FROM json_each({:students}))
    `).bind(params).all(rows);
    for (const row of rows) ranks.set(groupKey + ":" + row.student + ":" + row.period,
      { student: row.student, period: row.period, rank: row.rank, class_size: row.class_size });
  }
  const result = [];
  for (const enrollment of enrollments) {
    if (!ownStudents.has(enrollment.student_id)) continue;
    for (const period of periods) {
      if (period.year !== enrollment.academic_year_id) continue;
      const rank = ranks.get(enrollment.class_id + ":" + enrollment.academic_year_id + ":" + enrollment.student_id + ":" + period.id);
      if (rank) result.push(rank);
    }
  }
  return result;
}
module.exports = reportRanks;
