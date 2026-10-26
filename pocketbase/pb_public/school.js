let schoolData = null,
  schoolPage = "overview",
  schoolEval = "",
  reportStudent = "",
  reportPeriod = "";
const schoolLabels = {
  overview: "Tableau de bord",
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
    admin = d.me.role === "administrator";
  if (!admin && schoolPage === "setup") schoolPage = "overview";
  app.innerHTML = `<nav class="admin-tabs">${admin ? '<button data-page="enrollments">Inscriptions & paiements</button><button data-page="structure">Classes & comptes</button>' : ""}</nav><div class="workspace"><aside class="workspace-menu"><h2>${esc(d.school.name)}</h2><p>${esc(d.me.first_name)} · ${roles[d.me.role]}</p>${Object.entries(
    schoolLabels,
  )
    .filter(
      ([key]) =>
        (admin || key !== "setup") &&
        (d.me.role !== "teacher" || key !== "finances"),
    )
    .map(
      ([key, label]) =>
        `<button data-school-page="${key}" aria-current="${key === schoolPage ? "page" : "false"}">${label}${key === "messages" && d.messages.some((m) => m.recipient === currentUser.id && !m.read) ? " ●" : ""}</button>`,
    )
    .join(
      "",
    )}</aside><div class="workspace-main"><span class="badge">${roles[d.me.role]}</span><h1>${schoolLabels[schoolPage]}</h1><div id="school-content">${schoolScreen(d)}</div></div></div>`;
}
function schoolScreen(d) {
  const admin = d.me.role === "administrator",
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
                  [...d.subjects].sort((a, b) => a.name.localeCompare(b.name, "fr")),
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
            ["Période", "Début", "Fin", "Action"],
            d.periods.map((x) => [
              esc(x.label),
              esc(x.starts_on),
              esc(x.ends_on),
              deleteButton("school_periods", x.id),
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
    case "grades": {
      const evals = d.evaluations;
      if (!evals.some((x) => x.id === schoolEval))
        schoolEval = evals[0]?.id || "";
      const ev = evals.find((x) => x.id === schoolEval),
        as = d.assignments.find((x) => x.id === ev?.assignment),
        roster = students.filter((s) =>
          d.enrollments.some(
            (e) => e.student_id === s.id && e.class_id === as?.classroom,
          ),
        );
      return `<div class="grid">${teaching ? panel("Créer une évaluation", d.assignments.length && d.periods.length ? opForm("evaluation", asSelect() + periodSelect() + field("title", "Titre") + dateField("held_on", "Date") + field("maximum", "Barème", "number", 'min="1" max="1000" value="20"') + field("weight", "Coefficient de l’évaluation", "number", 'min="0.1" max="20" step="0.1" value="1"')) : "<p>Les affectations et les périodes doivent être créées par l’administration.</p>") : ""}${
        teaching && ev
          ? panel(
              "Saisir ou corriger une note",
              `<label>Évaluation<select id="school-evaluation">${options(
                evals,
                (x) => x.id,
                (x) => x.title + " · " + titleOf(d, x.assignment),
                schoolEval,
              )}</select></label>` +
                opForm(
                  "grade",
                  hidden("evaluation", schoolEval) +
                    select("student", "Élève", roster, (x) => x.id, fullName) +
                    select(
                      "status",
                      "Statut",
                      [
                        { id: "graded", name: "Noté" },
                        { id: "absent", name: "Absent (exclu de la moyenne)" },
                        { id: "exempt", name: "Dispensé" },
                      ],
                      (x) => x.id,
                      (x) => x.name,
                    ) +
                    field(
                      "score",
                      "Note",
                      "number",
                      `min="0" max="${ev.maximum}" step="0.01" value="0"`,
                    ) +
                    `<label>Appréciation<input name="comment" maxlength="1000"></label>`,
                ),
            )
          : ""
      }</div>${panel(
        "Évaluations",
        table(
          [
            "Évaluation",
            "Classe / matière",
            "Période",
            "État",
            ...(teaching ? ["Action"] : []),
          ],
          evals.map((x) => [
            esc(x.title),
            esc(titleOf(d, x.assignment)),
            esc(d.periods.find((p) => p.id === x.period)?.label),
            x.published ? "Publiée" : "Brouillon",
            ...(teaching
              ? [
                  opButton(
                    "publish-evaluation",
                    { id: x.id, published: !x.published },
                    x.published ? "Dépublier" : "Publier",
                  ),
                ]
              : []),
          ]),
        ),
      )}${panel(
        "Notes",
        table(
          ["Élève", "Évaluation", "Note", "Appréciation"],
          d.grades.map((g) => {
            const e = evals.find((x) => x.id === g.evaluation);
            return [
              esc(person(d, g.student)),
              esc(e?.title),
              g.status === "graded"
                ? `${g.score} / ${e?.maximum}`
                : g.status === "absent"
                  ? "Absent"
                  : "Dispensé",
              esc(g.comment),
            ];
          }),
        ),
      )}<p class="empty">Les familles voient uniquement les évaluations publiées. Les absences et dispenses n’entrent pas dans les moyennes.</p>`;
    }
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
                  '<label>Salle (facultative)<input name="room" maxlength="100"></label>',
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
              ...(admin ? [deleteButton("timetable_slots", x.id)] : []),
            ]),
        ),
      )}<p class="empty">Créneaux récurrents par année scolaire ; les vacances et semaines alternées ne sont pas encore gérées.</p>`;
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
          ["Élève", "Motif", "État", ...(admin ? ["Décision"] : [])],
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
            ...(admin
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
        admin
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
                  [...d.subjects].sort((a, b) => a.name.localeCompare(b.name, "fr")),
                  (x) => x.id,
                  (x) => x.name,
                ) + field("name", "Nouveau nom"),
              ),
            )
          : ""
      }${admin ? panel("Modifier une fiche personne", opForm("edit-person", select("user", "Personne", d.people, (x) => x.id, fullName) + field("first_name", "Prénom") + field("last_name", "Nom") + '<label>Téléphone<input name="phone" maxlength="40"></label>')) : ""}${panel("Mon mot de passe", opForm("change-password", field("current_password", "Mot de passe actuel", "password", 'autocomplete="current-password"') + field("password", "Nouveau mot de passe", "password", 'minlength="8" maxlength="200" autocomplete="new-password"')))}${admin ? panel("Réinitialiser un mot de passe scolaire", opForm("reset-password", select("user", "Compte", d.people, (x) => x.id, fullName) + field("password", "Nouveau mot de passe temporaire", "password", 'minlength="8" maxlength="200" autocomplete="new-password"')) + '<p class="empty">Transmettez ce mot de passe en privé. Les anciens jetons du compte sont invalidés par PocketBase.</p>') : ""}${
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
  )}${d.me.role === "administrator" && en ? panel("Appréciation générale", opForm("report-comment", hidden("student", reportStudent) + hidden("period", reportPeriod) + area("comment", "Appréciation", 4000))) : ""}</div><section class="panel" id="school-report"><h2>${esc(d.school.name)} · Bulletin</h2><p>${esc(person(d, reportStudent))} · ${esc(d.classes.find((c) => c.id === en?.class_id)?.name || "Non inscrit")} · ${esc(period?.label || "Période non définie")}</p>${table(
    ["Matière", "Notes prises en compte", "Coefficient", "Moyenne /20"],
    [...groups].map(([subject, g]) => [
      esc(d.subjects.find((s) => s.id === subject)?.name),
      g.count,
      g.coefficient,
      g.average === null ? "—" : g.average.toFixed(2),
    ]),
  )}<h3>Moyenne générale : ${general} /20</h3><p class="prewrap">${esc(comment)}</p><p class="empty">Moyennes pondérées des seules évaluations publiées. Les absences et dispenses sont exclues. Ce bulletin est un document interne de l’établissement.</p></section>`;
}
document.addEventListener("click", async (event) => {
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
        "disable-user",
        "reset-password",
        "reverse-payment",
      ].includes(op) &&
      !window.confirm("Confirmer cette opération ?")
    )
      return;
    quick.disabled = true;
    try {
      await pb("etudia/action", {
        operation: op,
        data: JSON.parse(quick.dataset.payload),
      });
      if (adminPage === "workspace" || currentUser.role !== "administrator")
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
    if (operation === "import-students") {
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
      a.download = "etudia-identifiants-confidentiels.csv";
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
      if (adminPage === "workspace" || currentUser.role !== "administrator")
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
