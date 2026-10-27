function seed(app, password) {
  if (typeof password !== "string" || password.length < 12)
    throw new Error("A demo password of at least 12 characters is required.");
  // Only seed a fresh, explicitly isolated demo database. Never replace school data.
  if (app.findAllRecords("establishments").length) return;
  app.runInTransaction((tx) => {
    const save = (name, fields) => {
      const record = new Record(tx.findCollectionByNameOrId(name));
      for (const key of Object.keys(fields)) {
        if (key === "password") record.setPassword(fields[key]);
        else record.set(key, fields[key]);
      }
      tx.save(record);
      return record;
    };
    const firstNames = [
      "Awa",
      "Issa",
      "Aminata",
      "Moussa",
      "Fatou",
      "Idrissa",
      "Mariam",
      "Adama",
      "Rokia",
      "Oumar",
      "Salimata",
      "Abdou",
      "Assetou",
      "Seydou",
      "Fanta",
      "Boubacar",
      "Alima",
      "Yacouba",
      "Nafissatou",
      "Souleymane",
    ];
    const lastNames = [
      "Sawadogo",
      "Ouédraogo",
      "Kaboré",
      "Traoré",
      "Sanou",
      "Diallo",
      "Zongo",
      "Compaoré",
      "Konaté",
      "Sangaré",
    ];
    const schools = [
      "Collège Horizon — fictif",
      "Groupe scolaire Baobab — fictif",
      "Lycée Avenir — fictif",
    ];
    for (let s = 0; s < schools.length; s++) {
      const suffix = s === 0 ? "" : String(s + 1);
      const school = save("establishments", {
        name: schools[s],
        country: "Burkina Faso",
        city: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou"][s],
      });
      const common = { school: school.id };
      const person = (role, index, login_id, first_name, last_name) =>
        save("school_users", {
          establishment_id: school.id,
          role,
          first_name,
          last_name,
          login_id,
          email: `e${s + 1}.${role}${index + 1}@demo.invalid`,
          emailVisibility: true,
          password,
        });
      const admins = ["Direction", "Scolarité", "Comptabilité"].map((name, i) =>
        person(
          "administrator",
          i,
          i === 0 ? "DEMOADMIN" + suffix : `E${s + 1}ADMIN${i + 1}`,
          name,
          "Démo",
        ),
      );
      const teachers = Array.from({ length: 6 }, (_, i) =>
        person(
          "teacher",
          i,
          i === 0 ? "DEMOPROF" + suffix : `E${s + 1}PROF${i + 1}`,
          firstNames[(i + 4 * s) % firstNames.length],
          "Démo-" + lastNames[(i + s) % lastNames.length],
        ),
      );
      // The first-name list repeats after 20 pupils. Advance the family-name
      // sequence for the next cohort so different classes never look identical.
      const familyName = (index) =>
        "Démo-" +
        lastNames[(index + Math.floor(index / 10) + s) % lastNames.length];
      const parents = Array.from({ length: 20 }, (_, i) =>
        person(
          "parent",
          i,
          i === 0 ? "DEMOPARENT" + suffix : `E${s + 1}PARENT${i + 1}`,
          firstNames[(i + 7) % firstNames.length],
          familyName(i),
        ),
      );
      const year = save("academic_years", {
        establishment_id: school.id,
        label: "2026–2027",
        starts_on: "2026-09-01 00:00:00Z",
        ends_on: "2027-07-31 00:00:00Z",
        is_active: true,
      });
      const periods = [
        ["Trimestre 1", "2026-09-01", "2026-12-31"],
        ["Trimestre 2", "2027-01-01", "2027-03-31"],
        ["Trimestre 3", "2027-04-01", "2027-07-31"],
      ].map(([label, starts_on, ends_on]) =>
        save("school_periods", {
          ...common,
          year: year.id,
          label,
          starts_on,
          ends_on,
        }),
      );
      const classes = ["6e A", "5e A", "4e A", "3e A"].map((name) =>
        save("classes", {
          establishment_id: school.id,
          academic_year_id: year.id,
          name,
          capacity: 30,
        }),
      );
      const subjects = ["Mathématiques", "Français", "Anglais"].map((name) =>
        tx.findFirstRecordByFilter(
          "subjects",
          "establishment_id={:school} && name={:name}",
          { school: school.id, name },
        ),
      );
      const students = [];
      for (let i = 0; i < 40; i++) {
        const student = person(
          "student",
          i,
          i === 0
            ? "DEMOELEVE" + suffix
            : `E${s + 1}ELEVE${String(i + 1).padStart(3, "0")}`,
          firstNames[(i + s * 3) % firstNames.length],
          familyName(Math.floor(i / 2)),
        );
        students.push(student);
        const enrollment = save("enrollments", {
          establishment_id: school.id,
          academic_year_id: year.id,
          class_id: classes[Math.floor(i / 10)].id,
          student_id: student.id,
          enrolled_on: "2026-09-15",
          registration_fee: 10000,
          tuition_fee: 90000,
        });
        save("parent_links", {
          ...common,
          parent: parents[Math.floor(i / 2)].id,
          student: student.id,
        });
        const amount = [0, 30000, 100000, 60000][i % 4];
        if (amount) {
          const payment = save("payments", {
            establishment_id: school.id,
            enrollment_id: enrollment.id,
            recorded_by: admins[2].id,
            amount,
            paid_on: "2026-10-15",
            method: ["cash", "mobile_money", "bank_transfer"][i % 3],
            reference: "EXEMPLE-FICTIF-" + (i + 1),
            request_key: `demo-e${s + 1}-${i + 1}`,
          });
          if (i === 3)
            save("payment_reversals", {
              ...common,
              payment: payment.id,
              actor: admins[2].id,
              reason:
                "Annulation fictive pour illustrer une correction de saisie.",
            });
        }
        // Full-year schedule equals the annual fee, never an extra charge.
        for (let q = 0; q < 4; q++)
          save("payment_deadlines", {
            ...common,
            enrollment: enrollment.id,
            due_on: ["2026-09-30", "2026-11-30", "2027-02-28", "2027-05-31"][q],
            amount: 25000,
            label: `Échéance fictive ${q + 1}/4`,
          });
        save("report_comments", {
          ...common,
          period: periods[0].id,
          student: student.id,
          comment:
            [
              "Bon travail dans l’ensemble. Poursuivre les efforts.",
              "Participation régulière, des progrès en rédaction sont attendus.",
              "Résultats encourageants. Attention à la ponctualité.",
              "Des difficultés à accompagner avec des exercices réguliers.",
            ][i % 4] + " (Exemple fictif.)",
        });
      }
      for (let c = 0; c < classes.length; c++) {
        const classStudents = students.slice(c * 10, c * 10 + 10);
        for (let m = 0; m < subjects.length; m++) {
          const teacher = teachers[m + (c % 2) * 3];
          const assignment = save("teaching_assignments", {
            ...common,
            teacher: teacher.id,
            classroom: classes[c].id,
            subject: subjects[m].id,
            coefficient: m === 2 ? 2 : 4,
          });
          const start = String(8 + c).padStart(2, "0") + ":00";
          const end = String(9 + c).padStart(2, "0") + ":00";
          save("timetable_slots", {
            ...common,
            assignment: assignment.id,
            weekday: m + 1,
            start_time: start,
            end_time: end,
            room: "Salle " + (c + 1),
            week_type: "all",
            valid_from: "",
            valid_until: "",
          });
          for (let e = 0; e < 2; e++) {
            const evaluation = save("evaluations", {
              ...common,
              assignment: assignment.id,
              period: periods[0].id,
              title:
                ["Interrogation", "Devoir surveillé"][e] +
                " — " +
                subjects[m].getString("name"),
              held_on: ["2026-10-12", "2026-10-20"][e],
              maximum: 20,
              weight: e + 1,
              published: true,
            });
            classStudents.forEach((student, j) => {
              const absent = j === 9 && m === 1 && e === 1;
              const score =
                c === 0 && j === 0
                  ? 16
                  : 6 + ((j * 3 + c + m * 2 + e + s) % 14);
              save("school_grades", {
                ...common,
                evaluation: evaluation.id,
                student: student.id,
                score: absent ? 0 : score,
                status: absent ? "absent" : "graded",
                comment: absent ? "Absence fictive." : "Évaluation fictive.",
              });
            });
          }
          if (m === 0) {
            save("evaluations", {
              ...common,
              assignment: assignment.id,
              period: periods[0].id,
              title: "Évaluation en préparation",
              held_on: "2026-11-05",
              maximum: 20,
              weight: 1,
              published: false,
            });
            classStudents.forEach((student, j) => {
              const status =
                j % 5 === 3 ? "absent" : j % 5 === 4 ? "late" : "present";
              const attendance = save("attendance", {
                ...common,
                assignment: assignment.id,
                student: student.id,
                held_on: "2026-10-23",
                status,
                minutes: status === "late" ? 10 : 0,
                justified: false,
                note: "Appel fictif.",
              });
              if (status === "absent")
                save("absence_requests", {
                  ...common,
                  attendance: attendance.id,
                  author: parents[Math.floor((c * 10 + j) / 2)].id,
                  reason:
                    "Justification de démonstration — aucune donnée médicale réelle.",
                  status: "pending",
                });
            });
          }
          const homework = save("homework", {
            ...common,
            assignment: assignment.id,
            title: "Exercices — " + subjects[m].getString("name"),
            instructions: [
              "Résoudre 2x = 6 et expliquer les étapes.",
              "Rédiger un paragraphe de cinq phrases sur une journée à l’école.",
              "Write five sentences introducing a fictional character.",
            ][m],
            due_on: "2026-11-02",
          });
          classStudents.slice(0, 5).forEach((student, j) =>
            save("submissions", {
              ...common,
              homework: homework.id,
              student: student.id,
              answer: [
                "Ma réponse de démonstration.",
                "Voici les étapes de mon raisonnement.",
              ][j % 2],
              feedback:
                j % 2 === 0
                  ? "Bon travail. Exemple de retour du professeur."
                  : "",
            }),
          );
          save("lesson_log", {
            ...common,
            assignment: assignment.id,
            held_on: "2026-10-26",
            title: [
              "Équations du premier degré",
              "Le paragraphe argumenté",
              "Introducing yourself",
            ][m],
            content:
              "Séance fictive : rappel du cours, exercices guidés et correction collective.",
          });
        }
      }
      [
        [
          "Bienvenue dans la démo",
          "Ces comptes et toutes les données sont fictifs. Ne saisissez aucune donnée réelle.",
          "all",
        ],
        [
          "Réunion pédagogique",
          "Réunion fictive des enseignants mercredi à 15 h.",
          "teacher",
        ],
        [
          "Rencontre parents-professeurs",
          "Exemple de communication destinée aux familles.",
          "parent",
        ],
        [
          "Activités du club lecture",
          "Exemple d’annonce destinée aux élèves.",
          "student",
        ],
      ].forEach(([title, body, audience]) =>
        save("school_announcements", {
          ...common,
          author: admins[0].id,
          title,
          body,
          audience,
        }),
      );
      for (let i = 0; i < 5; i++)
        save("school_messages", {
          ...common,
          sender: teachers[0].id,
          recipient: parents[i].id,
          subject: "Suivi scolaire — exemple fictif",
          body: "Bonjour, voici un exemple de message privé sur le travail en classe.",
          read: i % 2 === 0,
        });
      for (let i = 1; i < admins.length; i++)
        save("school_messages", {
          ...common,
          sender: admins[0].id,
          recipient: admins[i].id,
          subject: "Organisation interne — exemple fictif",
          body: "Message de démonstration entre la direction et le service administratif.",
          read: false,
        });
      save("school_audit", {
        ...common,
        actor: admins[0].id,
        action: "demo-seed",
        entity: "establishments",
        record_id: school.id,
        summary:
          "Jeu fictif : 40 élèves, 20 parents, 6 enseignants, 3 administrateurs et 4 classes.",
      });
    }
  });
  console.log(
    "Demo dataset ready: 3 schools, 120 students, 60 parents, 18 teachers, 9 administrators.",
  );
}
module.exports = { seed };
