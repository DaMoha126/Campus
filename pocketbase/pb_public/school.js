let schoolData = null,
  schoolPage = "overview",
  schoolEval = "",
  reportStudent = "",
  reportPeriod = "";
const schoolLabels = {
  overview: "Tableau de bord",
  classes: "Classes",
  setup: "Organisation pédagogique",
  grades: "Notes & évaluations",
  homework: "Devoirs & rendus",
  lessons: "Cahier de textes",
  timetable: "Emploi du temps",
  attendance: "Appel & absences",
  announcements: "Annonces",
  messages: "Messagerie",
  reports: "Bulletins",
  finances: "Scolarité & versements",
  settings: "Compte & sécurité",
};
const titleOf = (d, id) => {
  const a = d.assignments.find((x) => x.id === id);
  return a
    ? (d.classes.find((c) => c.id === a.classroom)?.name || "Classe") +
        " · " +
        (d.subjects.find((s) => s.id === a.subject)?.name || "Matière")
    : "Affectation";
};
const person = (d, id) => fullName(d.people.find((x) => x.id === id));
const select = (name, label, items, id, nameOf, selected = "") =>
  `<label>${label}<select name="${name}" required>${options(items, id, nameOf, selected)}</select></label>`;
const area = (name, label, max = 10000) =>
  `<label>${label}<textarea name="${name}" maxlength="${max}" required rows="4"></textarea></label>`;
const hidden = (name, v) =>
  `<input type="hidden" name="${name}" value="${esc(v)}">`;
const opForm = (op, html, label = "Enregistrer") =>
  `<form data-operation="${op}">${html}<button type="submit">${label}</button></form>`;
const panel = (title, html) =>
  `<section class="panel"><h2>${title}</h2>${html}</section>`;
const table = (headers, rows) =>
  rows.length
    ? `<div class="table-wrap"><table><thead><tr>${headers.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : '<p class="empty">Aucun élément pour le moment.</p>';
const opButton = (op, data, label) =>
  `<button data-quick-operation="${op}" data-payload="${esc(JSON.stringify(data))}">${label}</button>`;
const deleteButton = (entity, id) =>
  opButton("delete-item", { entity, id }, "Retirer");
async function schoolWorkspace() {
  schoolData = await pb("etudia/state");
  const d = schoolData,
    admin = d.me.role === "administrator",
    schoolLife = d.permissions?.schoolLife,
    finance =
      d.permissions?.finance || ["parent", "student"].includes(d.me.role);
  if (
    (!admin && schoolPage === "setup") ||
    (["parent", "student"].includes(d.me.role) && schoolPage === "classes")
  )
    schoolPage = "overview";
  app.innerHTML = `<nav class="admin-tabs">${admin ? '<button data-page="enrollments">Inscriptions & paiements</button><button data-page="structure">Classes & comptes</button>' : ""}</nav><div class="workspace"><aside class="workspace-menu"><h2>${esc(d.school.name)}</h2><p>${esc(d.me.first_name)} · ${roles[d.me.role]}</p>${Object.entries(
    schoolLabels,
  )
    .filter(
      ([key]) =>
        (admin || key !== "setup") &&
        (finance || key !== "finances") &&
        (d.me.role !== "accountant" ||
          ["finances", "messages", "settings"].includes(key)) &&
        (d.me.role !== "teacher" || key !== "finances") &&
        (!["parent", "student"].includes(d.me.role) || key !== "classes"),
    )
    .map(
      ([key, label]) =>
        `<button data-school-page="${key}" aria-current="${key === schoolPage ? "page" : "false"}">${label}${key === "messages" && d.messages.some((m) => m.recipient === currentUser.id && !m.read) ? " ●" : ""}</button>`,
    )
    .join(
      "",
    )}</aside><div class="workspace-main"><span class="badge">${roles[d.me.role]}</span><h1>${schoolLabels[schoolPage]}</h1><div id="school-content">${schoolScreen(d)}</div></div></div>`;
}
let gradesClass = null,
  gradesSubject = "",
  gradesPeriod = null,
  classesYear = null,
  selectedClass = "";
const schoolCompare = (a, b) =>
  String(a).localeCompare(String(b), "fr", { numeric: true });
function schoolClassLabel(d, classroom) {
  return (
    classroom.name +
    " · " +
    (d.years.find((y) => y.id === classroom.academic_year_id)?.label ||
      "Année inconnue")
  );
}
function schoolSortedClasses(d) {
  return [...d.classes].sort(
    (a, b) =>
      schoolCompare(
        d.years.find((y) => y.id === b.academic_year_id)?.label,
        d.years.find((y) => y.id === a.academic_year_id)?.label,
      ) || schoolCompare(a.name, b.name),
  );
}
function schoolClassRoster(d, id) {
  const ids = new Set(
    d.enrollments.filter((e) => e.class_id === id).map((e) => e.student_id),
  );
  return d.people
    .filter((p) => p.role === "student" && ids.has(p.id))
    .sort(
      (a, b) =>
        schoolCompare(a.last_name, b.last_name) ||
        schoolCompare(a.first_name, b.first_name),
    );
}
function classesScreen(d) {
  const admin = d.me.role === "administrator",
    schoolLife = d.permissions?.schoolLife;
  if (
    classesYear === null ||
    (classesYear && !d.years.some((y) => y.id === classesYear))
  )
    classesYear = d.years.find((y) => y.is_active)?.id || d.years[0]?.id || "";
  const classes = schoolSortedClasses(d).filter(
    (c) => !classesYear || c.academic_year_id === classesYear,
  );
  if (!classes.some((c) => c.id === selectedClass))
    selectedClass = classes[0]?.id || "";
  const classroom = classes.find((c) => c.id === selectedClass);
  const roster = schoolClassRoster(d, selectedClass);
  const assignments = d.assignments
    .filter((a) => a.classroom === selectedClass)
    .sort((a, b) =>
      schoolCompare(
        d.subjects.find((s) => s.id === a.subject)?.name,
        d.subjects.find((s) => s.id === b.subject)?.name,
      ),
    );
  const enrolledIds = new Set(
      d.enrollments
        .filter((e) => !classesYear || e.academic_year_id === classesYear)
        .map((e) => e.student_id),
    ),
    availableStudents = d.people.filter(
      (p) => p.role === "student" && !enrolledIds.has(p.id),
    ),
    studentsForLink = d.people.filter((p) => p.role === "student"),
    parents = d.people.filter((p) => p.role === "parent");
  return (
    panel(
      "Année scolaire",
      `<label>Année scolaire<select id="classes-year"><option value="">Toutes les années</option>${options(
        d.years,
        (y) => y.id,
        (y) => y.label,
        classesYear,
      )}</select></label>`,
    ) +
    `<div class="class-cards">${classes.map((c) => panel(esc(c.name), `<p>${esc(d.years.find((y) => y.id === c.academic_year_id)?.label)}</p><p><strong>${schoolClassRoster(d, c.id).length}</strong> élèves inscrits · capacité ${c.capacity}</p><button data-open-class="${esc(c.id)}" aria-pressed="${selectedClass === c.id}">Ouvrir ${esc(c.name)}</button>`)).join("") || '<p class="empty">Aucune classe pour cette année.</p>'}</div>` +
    (classroom
      ? `<section class="panel" id="class-detail"><h2>${esc(schoolClassLabel(d, classroom))}</h2><button data-class-notes="${esc(classroom.id)}">Consulter les notes de cette classe</button><h3>Élèves inscrits (${roster.length})</h3>${table(
          ["Élève", ...(schoolLife ? ["Matricule"] : []), "Parents liés"],
          roster.map((p) => [
            esc(fullName(p)),
            ...(schoolLife ? [esc(p.login_id || "—")] : []),
            d.links
              .filter((l) => l.student === p.id)
              .map((l) => esc(person(d, l.parent)))
              .join(", ") || "—",
          ]),
        )}<h3>Matières et enseignants</h3>${table(
          ["Matière", "Enseignant", "Coefficient"],
          assignments.map((a) => [
            esc(d.subjects.find((s) => s.id === a.subject)?.name),
            esc(person(d, a.teacher)),
            a.coefficient,
          ]),
        )}${schoolLife ? `<details><summary>Modifier cette classe</summary>${opForm("edit-class", hidden("id", classroom.id) + field("name", "Nom de la classe", "text", `value="${esc(classroom.name)}"`) + field("capacity", "Capacité", "number", `min="1" max="1000" value="${classroom.capacity}"`))}</details>` : ""}</section>`
      : "") +
    (admin
      ? panel(
          "Créer une classe",
          d.years.length
            ? `<form data-action="classes">${field("name", "Nom de la classe")}${select(
                "yearId",
                "Année scolaire",
                d.years,
                (y) => y.id,
                (y) => y.label,
                classesYear,
              )}${field("capacity", "Capacité", "number", 'min="1" max="1000" value="30"')}<button type="submit">Créer la classe</button></form>`
            : "<p>Créez d’abord une année scolaire dans Classes & comptes.</p>",
        )
      : "") +
    (d.me.role === "school_life"
      ? `<div class="grid">${panel(
          "Créer un compte élève ou parent",
          `<form data-operation="create-person">${field("first_name", "Prénom")}${field("last_name", "Nom")}<label>Profil<select name="role"><option value="student">Élève</option><option value="parent">Parent</option></select></label><label>Email (facultatif)<input name="email" type="email" maxlength="200"></label><label>Téléphone (facultatif)<input name="phone" maxlength="40"></label><button type="submit">Créer le compte et télécharger ses identifiants</button></form><p class="empty">Le mot de passe temporaire et le matricule sont téléchargés une seule fois. Remettez le fichier au titulaire par un canal privé.</p>`,
        )}${panel(
          "Affecter un élève à une classe",
          classes.length && availableStudents.length
            ? opForm(
                "enrollment",
                select(
                  "student",
                  "Élève sans inscription cette année",
                  availableStudents,
                  (x) => x.id,
                  fullName,
                ) +
                  select(
                    "classroom",
                    "Classe",
                    classes,
                    (x) => x.id,
                    (x) => x.name,
                  ) +
                  hidden("year", classesYear) +
                  field(
                    "enrolled_on",
                    "Date d’inscription",
                    "date",
                    `value="${today()}"`,
                  ),
                "Inscrire dans la classe",
              ) +
                '<p class="empty">Les frais et le suivi des versements restent gérés par la comptabilité.</p>'
            : '<p class="empty">Choisissez une année avec une classe et un élève disponible.</p>',
        )}${panel(
          "Relier un parent à son enfant",
          parents.length && studentsForLink.length
            ? opForm(
                "parent-link",
                select("parent", "Parent", parents, (x) => x.id, fullName) +
                  select(
                    "student",
                    "Élève",
                    studentsForLink,
                    (x) => x.id,
                    fullName,
                  ),
                "Enregistrer le lien familial",
              )
            : '<p class="empty">Créez un compte parent et un compte élève pour établir leur lien.</p>',
        )}</div>`
      : "")
  );
}
function gradesScreen(d) {
  const teaching = ["administrator", "teacher"].includes(d.me.role);
  const classes = schoolSortedClasses(d);
  if (
    gradesClass === null ||
    (gradesClass && !classes.some((c) => c.id === gradesClass))
  )
    gradesClass =
      classes.find(
        (c) => d.years.find((y) => y.id === c.academic_year_id)?.is_active,
      )?.id ||
      classes[0]?.id ||
      "";
  const classAssignments = d.assignments.filter(
    (a) => !gradesClass || a.classroom === gradesClass,
  );
  const subjects = d.subjects
    .filter((s) => classAssignments.some((a) => a.subject === s.id))
    .sort((a, b) => schoolCompare(a.name, b.name));
  if (!subjects.some((s) => s.id === gradesSubject)) gradesSubject = "";
  const assignments = classAssignments.filter(
    (a) => !gradesSubject || a.subject === gradesSubject,
  );
  const years = new Set(
    classes
      .filter((c) => !gradesClass || c.id === gradesClass)
      .map((c) => c.academic_year_id),
  );
  const periods = d.periods
    .filter((p) => years.has(p.year))
    .sort((a, b) => schoolCompare(a.starts_on, b.starts_on));
  if (
    gradesPeriod === null ||
    (gradesPeriod && !periods.some((p) => p.id === gradesPeriod))
  )
    gradesPeriod =
      periods.find((p) => d.years.find((y) => y.id === p.year)?.is_active)
        ?.id ||
      periods[0]?.id ||
      "";
  const assignmentIds = new Set(assignments.map((a) => a.id));
  const evals = d.evaluations
    .filter(
      (e) =>
        assignmentIds.has(e.assignment) &&
        (!gradesPeriod || e.period === gradesPeriod),
    )
    .sort(
      (a, b) =>
        schoolCompare(a.held_on, b.held_on) || schoolCompare(a.title, b.title),
    );
  if (!evals.some((e) => e.id === schoolEval)) schoolEval = evals[0]?.id || "";
  const evaluation = evals.find((e) => e.id === schoolEval);
  const assignment = assignments.find((a) => a.id === evaluation?.assignment);
  const evaluationPeriod = d.periods.find((p) => p.id === evaluation?.period);
  const gradeEntryLocked = !!evaluationPeriod?.locked;
  const filters = panel(
    "Choisir une classe et une matière",
    `<div class="grade-filters"><label>Classe<select id="grades-class"><option value="" ${gradesClass === "" ? "selected" : ""}>Toutes les classes</option>${options(
      classes,
      (c) => c.id,
      (c) => schoolClassLabel(d, c),
      gradesClass,
    )}</select></label><label>Matière<select id="grades-subject"><option value="">Toutes les matières</option>${options(
      subjects,
      (s) => s.id,
      (s) => s.name,
      gradesSubject,
    )}</select></label><label>Période<select id="grades-period"><option value="" ${gradesPeriod === "" ? "selected" : ""}>Toutes les périodes</option>${options(
      periods,
      (p) => p.id,
      (p) =>
        p.label +
        (p.locked ? " · Clôturée" : "") +
        " · " +
        d.years.find((y) => y.id === p.year)?.label,
      gradesPeriod,
    )}</select></label></div>`,
  );
  const createPeriods = periods.filter(
    (p) =>
      !p.locked &&
      p.year ===
        classes.find((c) => c.id === assignments[0]?.classroom)
          ?.academic_year_id,
  );
  const create = teaching
    ? panel(
        "Créer une évaluation",
        assignments.length && createPeriods.length
          ? opForm(
              "evaluation",
              select(
                "assignment",
                "Classe et matière",
                assignments,
                (a) => a.id,
                (a) => titleOf(d, a.id),
              ) +
                select(
                  "period",
                  "Période",
                  createPeriods,
                  (p) => p.id,
                  (p) =>
                    p.label +
                    " · " +
                    d.years.find((y) => y.id === p.year)?.label,
                  gradesPeriod,
                ) +
                field("title", "Titre") +
                field("held_on", "Date", "date", `value="${today()}"`) +
                field(
                  "maximum",
                  "Barème",
                  "number",
                  'min="1" max="1000" value="20"',
                ) +
                field(
                  "weight",
                  "Coefficient de l’évaluation",
                  "number",
                  'min="0.1" max="20" step="0.1" value="1"',
                ),
            )
          : "<p>Affectez les enseignants et créez une période ouverte dans Organisation pédagogique.</p>",
      )
    : "";
  const entry =
    teaching && evaluation && gradeEntryLocked
      ? panel(
          "Période clôturée",
          "<p>La saisie, la correction et la publication des notes sont désactivées. La direction peut rouvrir cette période dans Organisation pédagogique.</p>",
        )
      : teaching && evaluation
        ? panel(
            "Saisir ou corriger une note",
            `<label>Évaluation<select id="school-evaluation">${options(
              evals,
              (e) => e.id,
              (e) => e.title + " · " + titleOf(d, e.assignment),
              schoolEval,
            )}</select></label>` +
              opForm(
                "grade",
                hidden("evaluation", schoolEval) +
                  select(
                    "student",
                    "Élève",
                    schoolClassRoster(d, assignment?.classroom),
                    (p) => p.id,
                    (p) => fullName(p) + (p.login_id ? " · " + p.login_id : ""),
                  ) +
                  select(
                    "status",
                    "Statut",
                    [
                      { id: "graded", name: "Noté" },
                      { id: "absent", name: "Absent (exclu de la moyenne)" },
                      { id: "exempt", name: "Dispensé" },
                    ],
                    (s) => s.id,
                    (s) => s.name,
                  ) +
                  field(
                    "score",
                    "Note",
                    "number",
                    `min="0" max="${evaluation.maximum}" step="0.01" value="0"`,
                  ) +
                  '<label>Appréciation<input name="comment" maxlength="1000"></label>',
              ),
          )
        : "";
  const grades = new Map(
    d.grades.map((g) => [g.evaluation + ":" + g.student, g]),
  );
  const groups = classes
    .filter((c) => !gradesClass || c.id === gradesClass)
    .map((c) => {
      const classGroups = assignments
        .filter((a) => a.classroom === c.id)
        .sort((a, b) =>
          schoolCompare(
            d.subjects.find((s) => s.id === a.subject)?.name,
            d.subjects.find((s) => s.id === b.subject)?.name,
          ),
        )
        .map((a) => {
          const evaluations = evals.filter((e) => e.assignment === a.id);
          const currentRoster = schoolClassRoster(d, c.id);
          const studentIds = new Set(currentRoster.map((p) => p.id));
          for (const g of d.grades)
            if (evaluations.some((e) => e.id === g.evaluation))
              studentIds.add(g.student);
          const roster = d.people
            .filter((p) => p.role === "student" && studentIds.has(p.id))
            .sort(
              (a, b) =>
                schoolCompare(a.last_name, b.last_name) ||
                schoolCompare(a.first_name, b.first_name),
            );
          const gradebook = evaluations.length
            ? table(
                [
                  "Élève",
                  ...evaluations.map(
                    (e) =>
                      `${esc(e.title)}<br><small>${esc(e.held_on)} · ${e.published ? "Publiée" : "Brouillon"}</small>`,
                  ),
                ],
                roster.map((p) => [
                  `<span class="student-name" data-grade-student="${esc(p.id)}">${esc(fullName(p))}</span>${p.login_id ? `<small class="grade-comment">${esc(p.login_id)}</small>` : ""}`,
                  ...evaluations.map((e) => {
                    const grade = grades.get(e.id + ":" + p.id);
                    const value = !grade
                      ? "—"
                      : grade.status === "absent"
                        ? "Absent"
                        : grade.status === "exempt"
                          ? "Dispensé"
                          : `${grade.score} / ${e.maximum}`;
                    return `${esc(value)}${grade?.comment ? `<small class="grade-comment">${esc(grade.comment)}</small>` : ""}`;
                  }),
                ]),
              )
            : '<p class="empty">Aucune évaluation pour cette matière et cette période.</p>';
          return `<section class="grade-subject" data-grade-subject="${esc(a.subject)}"><h3>${esc(d.subjects.find((s) => s.id === a.subject)?.name)}</h3><p>Enseignant : ${esc(person(d, a.teacher))} · Coefficient : ${a.coefficient}</p>${gradebook}${
            teaching && evaluations.length
              ? `<h4>Publication des évaluations</h4>${table(
                  ["Évaluation", "Date", "État", "Action"],
                  evaluations.map((e) => [
                    esc(e.title),
                    esc(e.held_on),
                    e.published ? "Publiée" : "Brouillon",
                    d.periods.find((p) => p.id === e.period)?.locked
                      ? "Période clôturée"
                      : opButton(
                          "publish-evaluation",
                          { id: e.id, published: !e.published },
                          e.published ? "Dépublier" : "Publier",
                        ),
                  ]),
                )}`
              : ""
          }</section>`;
        })
        .join("");
      return `<section class="panel grade-class" data-grade-class="${esc(c.id)}"><h2>${esc(schoolClassLabel(d, c))}</h2>${classGroups || "<p>Aucune matière affectée à cette classe.</p>"}</section>`;
    })
    .join("");
  return (
    filters +
    `<div class="grid">${create}${entry}</div><div id="grade-groups">${groups || '<p class="empty">Aucune classe accessible.</p>'}</div><p class="empty">Les notes sont regroupées par classe et matière. Les familles voient uniquement les évaluations publiées. Les absences et dispenses sont exclues des moyennes des bulletins.</p>`
  );
}

function schoolScreen(d) {
  const admin = d.me.role === "administrator",
    schoolLife = d.permissions?.schoolLife,
    teaching = admin || d.me.role === "teacher",
    students = d.people.filter((x) => x.role === "student"),
    asSelect = () =>
      select(
        "assignment",
        "Classe et matière",
        d.assignments,
        (x) => x.id,
        (x) => titleOf(d, x.id),
      ),
    periodSelect = () =>
      select(
        "period",
        "Période",
        d.periods,
        (x) => x.id,
        (x) => x.label + " · " + d.years.find((y) => y.id === x.year)?.label,
      );
  const dateField = (name, label) =>
    field(name, label, "date", `value="${today()}"`);
  const assignTable = table(
    [
      "Classe / matière",
      "Enseignant",
      "Coefficient",
      ...(admin ? ["Action"] : []),
    ],
    d.assignments.map((a) => [
      esc(titleOf(d, a.id)),
      esc(person(d, a.teacher)),
      a.coefficient,
      ...(admin ? [deleteButton("teaching_assignments", a.id)] : []),
    ]),
  );
  switch (schoolPage) {
    case "classes":
      return classesScreen(d);
    case "overview":
      return `<div class="metrics">${[
        ["Classes", d.classes.length],
        ["Devoirs", d.homework.length],
        [
          "Messages non lus",
          d.messages.filter((x) => x.recipient === currentUser.id && !x.read)
            .length,
        ],
        [
          "Absences / retards",
          d.attendance.filter((x) => x.status !== "present" && !x.justified)
            .length,
        ],
      ]
        .map(
          ([label, v]) =>
            `<div><strong>${v}</strong><span>${label}</span></div>`,
        )
        .join("")}</div>${panel(
        "À venir",
        table(
          ["Devoir", "Classe / matière", "Échéance"],
          d.homework
            .filter((x) => x.due_on >= today())
            .sort((a, b) => a.due_on.localeCompare(b.due_on))
            .slice(0, 10)
            .map((x) => [
              esc(x.title),
              esc(titleOf(d, x.assignment)),
              esc(x.due_on),
            ]),
        ),
      )}${panel(
        "Annonces récentes",
        d.announcements
          .slice(-5)
          .reverse()
          .map(
            (x) =>
              `<article class="item"><b>${esc(x.title)}</b><p class="prewrap">${esc(x.body)}</p></article>`,
          )
          .join("") || "<p>Aucune annonce.</p>",
      )}${panel("Mes classes et matières", assignTable)}`;
    case "setup":
      return `<div class="grid">${panel(
        "Importer et inscrire des élèves (CSV)",
        opForm(
          "import-students",
          select(
            "classroom",
            "Classe",
            d.classes,
            (x) => x.id,
            (x) =>
              x.name +
              " · " +
              d.years.find((y) => y.id === x.academic_year_id)?.label,
          ) +
            field(
              "enrolled_on",
              "Date d’inscription",
              "date",
              `value="${today()}"`,
            ) +
            field(
              "registration_fee",
              "Frais d’inscription communs (FCFA)",
              "number",
              'min="0" step="1" value="0"',
            ) +
            field(
              "tuition_fee",
              "Scolarité annuelle commune (FCFA)",
              "number",
              'min="0" step="1" value="0"',
            ) +
            area(
              "csv",
              "Collez votre CSV : first_name;last_name;email;phone",
              50000,
            ),
          "Importer",
        ) +
          '<p class="empty">100 élèves maximum. Un fichier confidentiel contenant les identifiants initiaux sera téléchargé. Aucun email automatique. Toute erreur annule le lot entier.</p>',
      )} ${panel(
        "Affecter un enseignant",
        d.assignments.length || d.classes.length
          ? opForm(
              "assignment",
              select(
                "teacher",
                "Enseignant",
                d.people.filter((x) => x.role === "teacher" && !x.disabled),
                (x) => x.id,
                fullName,
              ) +
                select(
                  "classroom",
                  "Classe",
                  d.classes,
                  (x) => x.id,
                  (x) =>
                    x.name +
                    " · " +
                    d.years.find((y) => y.id === x.academic_year_id)?.label,
                ) +
                select(
                  "subject",
                  "Matière",
                  [...d.subjects].sort((a, b) =>
                    a.name.localeCompare(b.name, "fr"),
                  ),
                  (x) => x.id,
                  (x) => x.name,
                ) +
                field(
                  "coefficient",
                  "Coefficient de la matière",
                  "number",
                  'min="0.1" max="20" step="0.1" value="1"',
                ),
            )
          : "<p>Créez les comptes, classes et matières dans Classes & comptes.</p>",
      )}${panel(
        "Relier un parent à un élève",
        opForm(
          "parent-link",
          select(
            "parent",
            "Parent",
            d.people.filter((x) => x.role === "parent"),
            (x) => x.id,
            fullName,
          ) + select("student", "Élève", students, (x) => x.id, fullName),
        ),
      )}${panel(
        "Périodes scolaires",
        opForm(
          "period",
          select(
            "year",
            "Année",
            d.years,
            (x) => x.id,
            (x) => x.label,
          ) +
            field("label", "Nom : 1er trimestre") +
            dateField("starts_on", "Début") +
            dateField("ends_on", "Fin"),
        ) +
          table(
            ["Période", "Début", "Fin", "État", "Action"],
            d.periods.map((x) => [
              esc(x.label),
              esc(x.starts_on),
              esc(x.ends_on),
              x.locked ? "Clôturée" : "Ouverte",
              `${opButton("lock-period", { id: x.id, locked: !x.locked }, x.locked ? "Rouvrir" : "Clôturer")}${deleteButton("school_periods", x.id)}`,
            ]),
          ),
      )}${panel(
        "Liens parent–enfant",
        table(
          ["Parent", "Élève", "Action"],
          d.links.map((x) => [
            esc(person(d, x.parent)),
            esc(person(d, x.student)),
            deleteButton("parent_links", x.id),
          ]),
        ),
      )}</div>${panel("Affectations", assignTable)}`;
    case "grades":
      return gradesScreen(d);
    case "homework":
      return `${teaching ? panel("Donner un devoir", d.assignments.length ? opForm("homework", asSelect() + field("title", "Titre") + area("instructions", "Consignes") + dateField("due_on", "À rendre le")) : "<p>Aucune affectation.</p>") : ""}${
        d.homework
          .slice()
          .sort((a, b) => b.due_on.localeCompare(a.due_on))
          .map((h) =>
            panel(
              esc(h.title),
              `<p>${esc(titleOf(d, h.assignment))} · À rendre le ${esc(h.due_on)}</p><p class="prewrap">${esc(h.instructions)}</p>${d.me.role === "student" ? opForm("submission", hidden("homework", h.id) + area("answer", "Ma réponse", 20000), "Rendre / remplacer ma réponse") : ""}${teaching && admin ? deleteButton("homework", h.id) : ""}${d.submissions
                .filter((s) => s.homework === h.id)
                .map(
                  (s) =>
                    `<article class="item"><b>${esc(person(d, s.student))}</b><p class="prewrap">${esc(s.answer)}</p><p>Correction : ${esc(s.feedback || "En attente")}</p>${teaching ? opForm("feedback", hidden("id", s.id) + area("feedback", "Retour de l’enseignant", 4000)) : ""}</article>`,
                )
                .join("")}`,
            ),
          )
          .join("") || "<p>Aucun devoir.</p>"
      }`;
    case "lessons":
      return `${teaching ? panel("Compléter le cahier de textes", d.assignments.length ? opForm("lesson", asSelect() + dateField("held_on", "Date") + field("title", "Titre de la séance") + area("content", "Contenu et travail réalisé")) : "<p>Aucune affectation.</p>") : ""}${d.lessons
        .slice()
        .sort((a, b) => b.held_on.localeCompare(a.held_on))
        .map((x) =>
          panel(
            esc(x.title),
            `<p>${esc(x.held_on)} · ${esc(titleOf(d, x.assignment))}</p><p class="prewrap">${esc(x.content)}</p>${admin ? deleteButton("lesson_log", x.id) : ""}`,
          ),
        )
        .join("")}`;
    case "timetable":
      return `${
        admin
          ? panel(
              "Ajouter un créneau hebdomadaire",
              opForm(
                "timetable",
                asSelect() +
                  select(
                    "weekday",
                    "Jour",
                    [
                      "Lundi",
                      "Mardi",
                      "Mercredi",
                      "Jeudi",
                      "Vendredi",
                      "Samedi",
                      "Dimanche",
                    ].map((name, i) => ({ id: String(i + 1), name })),
                    (x) => x.id,
                    (x) => x.name,
                  ) +
                  field("start_time", "Début", "time") +
                  field("end_time", "Fin", "time") +
                  select(
                    "week_type",
                    "Rythme",
                    [
                      { id: "all", name: "Chaque semaine" },
                      { id: "odd", name: "Semaines impaires" },
                      { id: "even", name: "Semaines paires" },
                    ],
                    (x) => x.id,
                    (x) => x.name,
                  ) +
                  '<label>Salle (facultative)<input name="room" maxlength="100"></label><label>Valide à partir du (facultatif)<input name="valid_from" type="date"></label><label>Valide jusqu’au (facultatif)<input name="valid_until" type="date"></label>',
              ),
            )
          : ""
      }${panel(
        "Emploi du temps hebdomadaire",
        table(
          [
            "Jour",
            "Heure",
            "Classe / matière",
            "Enseignant",
            "Salle",
            "Rythme / validité",
            ...(admin ? ["Action"] : []),
          ],
          d.timetable
            .slice()
            .sort(
              (a, b) =>
                a.weekday - b.weekday ||
                a.start_time.localeCompare(b.start_time),
            )
            .map((x) => [
              [
                "Lundi",
                "Mardi",
                "Mercredi",
                "Jeudi",
                "Vendredi",
                "Samedi",
                "Dimanche",
              ][x.weekday - 1],
              `${x.start_time}–${x.end_time}`,
              esc(titleOf(d, x.assignment)),
              esc(
                person(
                  d,
                  d.assignments.find((a) => a.id === x.assignment)?.teacher,
                ),
              ),
              esc(x.room),
              `${x.week_type === "odd" ? "Semaines impaires" : x.week_type === "even" ? "Semaines paires" : "Chaque semaine"}${x.valid_from || x.valid_until ? `<small>${esc(x.valid_from || "Début d’année")} – ${esc(x.valid_until || "Fin d’année")}</small>` : ""}`,
              ...(admin ? [deleteButton("timetable_slots", x.id)] : []),
            ]),
        ),
      )}<p class="empty">Les semaines paires et impaires s’appuient sur la numérotation ISO. Les dates de validité permettent de limiter un créneau à une période de l’année scolaire ; les jours fériés et vacances sont à définir séparément.</p>`;
    case "attendance":
      return `${
        teaching
          ? panel(
              "Faire l’appel / corriger une présence",
              opForm(
                "attendance",
                asSelect() +
                  select("student", "Élève", students, (x) => x.id, fullName) +
                  dateField("held_on", "Date") +
                  select(
                    "status",
                    "Présence",
                    [
                      { id: "present", name: "Présent" },
                      { id: "absent", name: "Absent" },
                      { id: "late", name: "Retard" },
                    ],
                    (x) => x.id,
                    (x) => x.name,
                  ) +
                  field(
                    "minutes",
                    "Minutes de retard (si retard)",
                    "number",
                    'min="0" max="600" value="0"',
                  ) +
                  '<label>Remarque<input name="note" maxlength="2000"></label>',
              ),
            )
          : ""
      }${panel(
        "Registre",
        table(
          ["Élève", "Date", "Classe / matière", "État", "Justification"],
          d.attendance.map((x) => [
            esc(person(d, x.student)),
            esc(x.held_on),
            esc(titleOf(d, x.assignment)),
            x.status === "present"
              ? "Présent"
              : x.status === "absent"
                ? "Absent"
                : `Retard ${x.minutes} min`,
            x.justified
              ? "Justifiée"
              : x.status !== "present" &&
                  ["parent", "student"].includes(d.me.role)
                ? opForm(
                    "absence-request",
                    hidden("attendance", x.id) + area("reason", "Motif", 4000),
                    "Envoyer le justificatif",
                  )
                : "—",
          ]),
        ),
      )}${panel(
        "Demandes de justification",
        table(
          ["Élève", "Motif", "État", ...(schoolLife ? ["Décision"] : [])],
          d.absenceRequests.map((x) => [
            esc(
              person(
                d,
                d.attendance.find((a) => a.id === x.attendance)?.student,
              ),
            ),
            esc(x.reason),
            {
              pending: "En attente",
              accepted: "Acceptée",
              rejected: "Refusée",
            }[x.status],
            ...(schoolLife
              ? [
                  opButton(
                    "absence-review",
                    { id: x.id, status: "accepted" },
                    "Accepter",
                  ) +
                    " " +
                    opButton(
                      "absence-review",
                      { id: x.id, status: "rejected" },
                      "Refuser",
                    ),
                ]
              : []),
          ]),
        ),
      )}`;
    case "announcements":
      return `${
        schoolLife
          ? panel(
              "Publier une annonce",
              opForm(
                "announcement",
                field("title", "Titre") +
                  select(
                    "audience",
                    "Destinataires",
                    [
                      { id: "all", name: "Tout le monde" },
                      { id: "teacher", name: "Enseignants" },
                      { id: "parent", name: "Parents" },
                      { id: "student", name: "Élèves" },
                    ],
                    (x) => x.id,
                    (x) => x.name,
                  ) +
                  area("body", "Message"),
              ),
            )
          : ""
      }${d.announcements
        .slice()
        .reverse()
        .map((x) =>
          panel(esc(x.title), `<p class="prewrap">${esc(x.body)}</p>`),
        )
        .join("")}`;
    case "messages": {
      const recipients = d.people.filter(
        (x) =>
          x.id !== currentUser.id &&
          (!["parent", "student"].includes(d.me.role) ||
            ["teacher", "administrator"].includes(x.role)),
      );
      return `${panel(
        "Nouveau message",
        opForm(
          "message",
          select(
            "recipient",
            "Destinataire",
            recipients,
            (x) => x.id,
            (x) => fullName(x) + " · " + roles[x.role],
          ) +
            field("subject", "Objet") +
            area("body", "Message"),
        ),
      )}${d.messages
        .slice()
        .reverse()
        .map((x) =>
          panel(
            esc(x.subject),
            `<p>De ${esc(person(d, x.sender))} à ${esc(person(d, x.recipient))} · ${x.read ? "Lu" : "Non lu"}</p><p class="prewrap">${esc(x.body)}</p>${x.recipient === currentUser.id && !x.read ? opButton("message-read", { id: x.id }, "Marquer comme lu") : ""}`,
          ),
        )
        .join("")}`;
    }
    case "finances":
      return (
        d.enrollments
          .map((en) => {
            const b = balance(d, en),
              ps = d.payments.filter((p) => p.enrollment_id === en.id),
              deadlines = d.deadlines.filter((x) => x.enrollment === en.id),
              overdue = Math.max(
                0,
                deadlines
                  .filter((x) => x.due_on < today())
                  .reduce((s, x) => s + x.amount, 0) - b.paid,
              );
            return panel(
              esc(person(d, en.student_id)),
              `<p>${esc(d.years.find((y) => y.id === en.academic_year_id)?.label)} · ${b.status}</p><p>Total : ${money(b.total)} · Payé : ${money(b.paid)} · Reste : ${money(b.due)}</p><p>Échéances passées non couvertes : ${money(overdue)}</p>${table(
                ["Échéance", "Libellé", "Montant prévu"],
                deadlines.map((x) => [
                  esc(x.due_on),
                  esc(x.label),
                  money(x.amount),
                ]),
              )}${table(
                ["Date", "Montant", "État", "Reçu"],
                ps.map((x) => [
                  esc(x.paid_on),
                  money(x.amount),
                  d.reversals.some((r) => r.payment === x.id)
                    ? "Annulé"
                    : "Enregistré",
                  `<button data-family-receipt="${x.id}">Imprimer</button>`,
                ]),
              )}`,
            );
          })
          .join("") || "<p>Aucun dossier de scolarité visible.</p>"
      );
    case "reports":
      return reportScreen(d);
    case "settings":
      return `<p>Mon matricule : <b>${esc(d.me.login_id || "")}</b></p><div class="grid">${admin ? panel("Établissement", opForm("edit-school", field("name", "Nom", "text", `value="${esc(d.school.name)}"`) + field("country", "Pays", "text", `value="${esc(d.school.country)}"`) + `<label>Ville<input name="city" value="${esc(d.school.city)}"></label>`)) : ""}${
        admin
          ? panel(
              "Modifier une classe",
              opForm(
                "edit-class",
                select(
                  "id",
                  "Classe",
                  d.classes,
                  (x) => x.id,
                  (x) => x.name,
                ) +
                  field("name", "Nouveau nom") +
                  field("capacity", "Capacité", "number", 'min="1" max="1000"'),
              ),
            )
          : ""
      }${
        admin
          ? panel(
              "Modifier une matière",
              opForm(
                "edit-subject",
                select(
                  "id",
                  "Matière",
                  [...d.subjects].sort((a, b) =>
                    a.name.localeCompare(b.name, "fr"),
                  ),
                  (x) => x.id,
                  (x) => x.name,
                ) + field("name", "Nouveau nom"),
              ),
            )
          : ""
      }${schoolLife ? panel("Modifier une fiche personne", opForm("edit-person", select("user", "Personne", d.people, (x) => x.id, fullName) + field("first_name", "Prénom") + field("last_name", "Nom") + '<label>Téléphone<input name="phone" maxlength="40"></label>')) : ""}${panel("Mon mot de passe", opForm("change-password", field("current_password", "Mot de passe actuel", "password", 'autocomplete="current-password"') + field("password", "Nouveau mot de passe", "password", 'minlength="8" maxlength="200" autocomplete="new-password"')))}${admin ? panel("Réinitialiser un mot de passe scolaire", opForm("reset-password", select("user", "Compte", d.people, (x) => x.id, fullName) + field("password", "Nouveau mot de passe temporaire", "password", 'minlength="8" maxlength="200" autocomplete="new-password"')) + '<p class="empty">Transmettez ce mot de passe en privé. Les anciens jetons du compte sont invalidés par PocketBase.</p>') : ""}${
        admin
          ? panel(
              "Activer l’année scolaire",
              opForm(
                "activate-year",
                select(
                  "year",
                  "Année",
                  d.years,
                  (x) => x.id,
                  (x) => x.label,
                ),
              ),
            )
          : ""
      }</div>${admin ? panel("Exporter les données scolaires", '<button id="export-school-json">Exporter JSON</button><p class="empty">Export des données visibles par votre compte, sans mots de passe. Pour une sauvegarde complète, arrêtez le logiciel puis copiez pb_data, ou utilisez les sauvegardes du tableau de bord PocketBase.</p>') : ""}${
        admin
          ? panel(
              "Comptes actifs et désactivés",
              table(
                ["Compte", "Rôle", "État", "Action"],
                d.people.map((x) => [
                  esc(fullName(x)),
                  roles[x.role],
                  x.disabled ? "Désactivé" : "Actif",
                  x.id === currentUser.id
                    ? "Votre compte"
                    : opButton(
                        "disable-user",
                        { user: x.id, disabled: !x.disabled },
                        x.disabled ? "Réactiver" : "Désactiver",
                      ),
                ]),
              ),
            )
          : ""
      }${
        admin
          ? panel(
              "Journal des opérations (200 dernières)",
              table(
                ["Date", "Agent", "Action", "Référence"],
                d.audit.map((x) => [
                  esc(x.created),
                  esc(person(d, x.actor)),
                  esc(x.action),
                  esc(x.record_id),
                ]),
              ),
            )
          : ""
      }`;
    default:
      return "<p>Choisissez un module.</p>";
  }
}
function reportScreen(d) {
  const students = d.people.filter((x) => x.role === "student");
  if (!students.some((x) => x.id === reportStudent))
    reportStudent = students[0]?.id || "";
  if (!d.periods.some((x) => x.id === reportPeriod))
    reportPeriod = d.periods[0]?.id || "";
  const period = d.periods.find((x) => x.id === reportPeriod),
    en = d.enrollments.find(
      (x) =>
        x.student_id === reportStudent && x.academic_year_id === period?.year,
    ),
    groups = new Map();
  for (const a of d.assignments.filter(
    (a) =>
      en && [en.class_id, ...(en.previous_classes || [])].includes(a.classroom),
  )) {
    const evals = d.evaluations.filter(
        (e) =>
          e.assignment === a.id && e.period === reportPeriod && e.published,
      ),
      ids = evals.map((x) => x.id);
    const grades = d.grades.filter(
      (g) =>
        g.student === reportStudent &&
        g.status === "graded" &&
        ids.includes(g.evaluation),
    );
    let sum = 0,
      w = 0;
    for (const g of grades) {
      const e = evals.find((x) => x.id === g.evaluation);
      sum += (g.score / e.maximum) * 20 * e.weight;
      w += e.weight;
    }
    const previous = groups.get(a.subject) || {
      sum: 0,
      weight: 0,
      count: 0,
      coefficient: a.coefficient,
    };
    previous.sum += sum;
    previous.weight += w;
    previous.count += grades.length;
    if (a.classroom === en.class_id) previous.coefficient = a.coefficient;
    previous.average = previous.weight ? previous.sum / previous.weight : null;
    groups.set(a.subject, previous);
  }
  let sum = 0,
    weight = 0;
  for (const g of groups.values())
    if (g.average !== null) {
      sum += g.average * g.coefficient;
      weight += g.coefficient;
    }
  const general = weight ? (sum / weight).toFixed(2) : "—";
  const averageFor = (studentId) => {
    const subjects = new Map();
    for (const assignment of d.assignments.filter(
      (x) => en && x.classroom === en.class_id,
    )) {
      const evals = d.evaluations.filter(
        (x) =>
          x.assignment === assignment.id &&
          x.period === reportPeriod &&
          x.published,
      );
      let subtotal = 0,
        weights = 0;
      for (const grade of d.grades) {
        const evaluation = evals.find((x) => x.id === grade.evaluation);
        if (
          !evaluation ||
          grade.student !== studentId ||
          grade.status !== "graded"
        )
          continue;
        subtotal += (grade.score / evaluation.maximum) * 20 * evaluation.weight;
        weights += evaluation.weight;
      }
      if (!weights) continue;
      const previous = subjects.get(assignment.subject) || {
        sum: 0,
        weight: 0,
      };
      previous.sum += (subtotal / weights) * assignment.coefficient;
      previous.weight += assignment.coefficient;
      subjects.set(assignment.subject, previous);
    }
    let total = 0,
      coefficients = 0;
    for (const subject of subjects.values()) {
      total += subject.sum;
      coefficients += subject.weight;
    }
    return coefficients ? total / coefficients : null;
  };
  const storedRank = d.reportRanks?.find(
    (x) => x.student === reportStudent && x.period === reportPeriod,
  );
  const roster = d.enrollments.filter(
    (x) =>
      en &&
      x.class_id === en.class_id &&
      x.academic_year_id === en.academic_year_id,
  );
  const peerAverages = roster
    .map((x) => averageFor(x.student_id))
    .filter((x) => x !== null);
  const ownAverage = weight ? sum / weight : null;
  const rank =
    storedRank ||
    (ownAverage === null
      ? null
      : {
          rank: 1 + peerAverages.filter((x) => x > ownAverage + 1e-9).length,
          class_size: peerAverages.length,
        });
  const rankLabel = rank
    ? `${rank.rank === 1 ? "1er" : `${rank.rank}e`} sur ${rank.class_size} élève${rank.class_size > 1 ? "s" : ""} classé${rank.class_size > 1 ? "s" : ""}`
    : "—";
  const numericAverage = weight ? sum / weight : null;
  const mention =
    numericAverage === null
      ? "—"
      : numericAverage >= 16
        ? "Excellent"
        : numericAverage >= 14
          ? "Très bien"
          : numericAverage >= 12
            ? "Bien"
            : numericAverage >= 10
              ? "Assez bien"
              : numericAverage >= 8
                ? "Insuffisant"
                : "Très insuffisant";
  const comment =
    d.reportComments.find(
      (x) => x.student === reportStudent && x.period === reportPeriod,
    )?.comment || "";
  return `<div class="grid">${panel(
    "Choisir le bulletin",
    `<label>Élève<select id="report-student">${options(students, (x) => x.id, fullName, reportStudent)}</select></label><label>Période<select id="report-period">${options(
      d.periods,
      (x) => x.id,
      (x) => x.label + " · " + d.years.find((y) => y.id === x.year)?.label,
      reportPeriod,
    )}</select></label><button id="print-report">Imprimer le bulletin</button>`,
  )}${d.permissions?.schoolLife && en ? panel("Appréciation générale", opForm("report-comment", hidden("student", reportStudent) + hidden("period", reportPeriod) + area("comment", "Appréciation", 4000))) : ""}</div><section class="panel" id="school-report"><h2>${esc(d.school.name)} · Bulletin</h2><p>${esc(person(d, reportStudent))} · ${esc(d.classes.find((c) => c.id === en?.class_id)?.name || "Non inscrit")} · ${esc(period?.label || "Période non définie")}</p>${table(
    ["Matière", "Notes prises en compte", "Coefficient", "Moyenne /20"],
    [...groups].map(([subject, g]) => [
      esc(d.subjects.find((s) => s.id === subject)?.name),
      g.count,
      g.coefficient,
      g.average === null ? "—" : g.average.toFixed(2),
    ]),
  )}<h3>Moyenne générale : ${general} /20</h3><p><strong>Rang :</strong> ${esc(rankLabel)} · <strong>Mention :</strong> ${esc(mention)}</p><p class="prewrap">${esc(comment)}</p><p class="empty">Rang calculé à partir des moyennes générales des élèves ayant au moins une note publiée dans la classe. À égalité, les élèves partagent le même rang. Les absences et dispenses sont exclues. Ce bulletin est un document interne de l’établissement.</p></section>`;
}
document.addEventListener("click", async (event) => {
  const openClass = event.target.closest("[data-open-class]");
  if (openClass) {
    selectedClass = openClass.dataset.openClass;
    document.querySelector("#school-content").innerHTML =
      schoolScreen(schoolData);
    document
      .querySelector("#class-detail")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  const notes = event.target.closest("[data-class-notes]");
  if (notes) {
    gradesClass = notes.dataset.classNotes;
    gradesSubject = "";
    gradesPeriod = null;
    schoolPage = "grades";
    await schoolWorkspace();
    return;
  }
  const page = event.target.closest("[data-school-page]");
  if (page) {
    schoolPage = page.dataset.schoolPage;
    await schoolWorkspace();
    return;
  }
  const quick = event.target.closest("[data-quick-operation]");
  if (quick) {
    const op = quick.dataset.quickOperation;
    if (
      [
        "delete-item",
        "lock-period",
        "disable-user",
        "reset-password",
        "reverse-payment",
      ].includes(op) &&
      !window.confirm(
        op === "lock-period"
          ? JSON.parse(quick.dataset.payload).locked
            ? "Clôturer cette période ? Les notes ne pourront plus être modifiées."
            : "Rouvrir cette période ?"
          : "Confirmer cette opération ?",
      )
    )
      return;
    quick.disabled = true;
    try {
      await pb("etudia/action", {
        operation: op,
        data: JSON.parse(quick.dataset.payload),
      });
      if (
        adminPage === "workspace" ||
        ["school_life", "teacher", "student", "parent"].includes(
          currentUser.role,
        )
      )
        await schoolWorkspace();
      else await start();
      notify("Modification enregistrée");
    } catch (e) {
      notify(e.message);
    } finally {
      quick.disabled = false;
    }
  }
  const familyReceipt = event.target.closest("[data-family-receipt]");
  if (familyReceipt) {
    latestData = schoolData;
    printReceipt(familyReceipt.dataset.familyReceipt);
  }
  if (event.target.closest("#export-school-json")) {
    const blob = new Blob([JSON.stringify(schoolData, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "etudia-export-" + today() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (event.target.closest("#print-report")) {
    document.querySelector("#payment-receipt")?.remove();
    const el = document.createElement("section");
    el.id = "payment-receipt";
    el.innerHTML = document.querySelector("#school-report").innerHTML;
    document.body.append(el);
    window.print();
  }
});
document.addEventListener("change", async (event) => {
  if (
    event.target.name === "assignment" &&
    event.target.closest('form[data-operation="evaluation"]')
  ) {
    const form = event.target.closest("form");
    const assignment = schoolData.assignments.find(
      (a) => a.id === event.target.value,
    );
    const year = schoolData.classes.find(
      (c) => c.id === assignment?.classroom,
    )?.academic_year_id;
    const period = form.querySelector('[name="period"]');
    period.innerHTML = options(
      schoolData.periods.filter((p) => p.year === year),
      (p) => p.id,
      (p) =>
        p.label + " · " + schoolData.years.find((y) => y.id === p.year)?.label,
      period.value,
    );
    return;
  }
  const filters = {
    "grades-class": "class",
    "grades-subject": "subject",
    "grades-period": "period",
    "classes-year": "year",
  };
  if (event.target.id in filters) {
    if (filters[event.target.id] === "class") {
      gradesClass = event.target.value;
      gradesSubject = "";
      gradesPeriod = null;
    }
    if (filters[event.target.id] === "subject")
      gradesSubject = event.target.value;
    if (filters[event.target.id] === "period")
      gradesPeriod = event.target.value;
    if (filters[event.target.id] === "year") classesYear = event.target.value;
    schoolEval = "";
    document.querySelector("#school-content").innerHTML =
      schoolScreen(schoolData);
    return;
  }
  if (event.target.id === "school-evaluation") schoolEval = event.target.value;
  else if (event.target.id === "report-student")
    reportStudent = event.target.value;
  else if (event.target.id === "report-period")
    reportPeriod = event.target.value;
  else return;
  await schoolWorkspace();
});
document.addEventListener("submit", async (event) => {
  const form = event.target,
    operation = form.dataset.operation;
  if (!operation) return;
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  const data = Object.fromEntries(new FormData(form));
  for (const key of [
    "coefficient",
    "maximum",
    "weight",
    "score",
    "weekday",
    "minutes",
    "amount",
    "capacity",
    "registration_fee",
    "tuition_fee",
  ])
    if (key in data) data[key] = Number(data[key]);
  try {
    if (
      ["reset-password", "reverse-payment"].includes(operation) &&
      !window.confirm("Confirmer cette opération ?")
    )
      return;
    const saved = await pb("etudia/action", { operation, data });
    if (["import-students", "create-person"].includes(operation)) {
      const rows = [
        ["Prénom", "Nom", "Email", "Matricule", "Mot de passe initial"],
        ...saved.credentials.map((x) => [
          x.first_name,
          x.last_name,
          x.email,
          x.login_id,
          x.password,
        ]),
      ];
      const quote = (v) =>
        '"' +
        String(v)
          .replace(/^\s*[=+@\-]|^[\t\r\n]/, "'$&")
          .replace(/"/g, '""') +
        '"';
      const blob = new Blob(
          ["\ufeff" + rows.map((r) => r.map(quote).join(";")).join("\r\n")],
          { type: "text/csv;charset=utf-8" },
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        operation === "create-person"
          ? "etudia-identifiants-compte-confidentiels.csv"
          : "etudia-identifiants-confidentiels.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (
      operation === "change-password" ||
      (operation === "reset-password" && data.user === currentUser.id)
    ) {
      authToken = "";
      currentUser = null;
      await start();
      notify("Mot de passe changé. Reconnectez-vous.");
    } else {
      if (
        adminPage === "workspace" ||
        ["school_life", "teacher", "student", "parent"].includes(
          currentUser.role,
        )
      )
        await schoolWorkspace();
      else await start();
      notify("Opération enregistrée");
    }
  } catch (e) {
    notify(e.message);
  } finally {
    button.disabled = false;
  }
});
