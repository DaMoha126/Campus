// Avoid one Go/JavaScript Record conversion per grade for the usual class view.
// The evaluation IDs come from the already-authorized state, never from input.
module.exports = function (app, school, evaluations, students) {
  const evaluationIds = [...new Set(evaluations.map(e => e.id))];
  if (!evaluationIds.length || (students && !students.length)) return [];
  // Preserve the existing path for unusually large full exports/directories.
  if (evaluationIds.length > 300 && !students) return null;
  const params = { school, evaluations: JSON.stringify(evaluationIds) };
  if (students) params.students = JSON.stringify([...new Set(students)]);
  const studentCondition = students ? `
    AND grade.student IN (SELECT value FROM json_each({:students}))
    AND EXISTS (SELECT 1 FROM evaluations published
      WHERE published.id = grade.evaluation
        AND published.school = {:school} AND published.published = 1)
  ` : "";
  const row = new DynamicModel({ payload: "" });
  app.db().newQuery(`
    SELECT COALESCE(json_group_array(json_object(
      'id', g.id, 'evaluation', g.evaluation, 'student', g.student,
      'score', g.score, 'status', g.status, 'comment', g.comment
    )), '[]') AS payload
    FROM (
      SELECT grade.id, grade.evaluation, grade.student, grade.score, grade.status, grade.comment
      FROM json_each({:evaluations}) selected
      CROSS JOIN school_grades grade ON grade.evaluation = selected.value
      WHERE grade.school = {:school}${studentCondition}
      ORDER BY grade.rowid
    ) g
  `).bind(params).one(row);
  return JSON.parse(row.payload);
};
