const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fixture = require("../support/pocketbase-fixture.cjs");
test(
  "browser: school workflows, receipts, imports, publication and XSS",
  { skip: !process.env.POCKETBASE_BIN || !process.env.CHROME_BIN },
  async () => {
    const { chromium } = require(
      process.env.ETUDIA_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright" : "playwright"),
    );
    const f = await fixture(31364);
    let browser;
    const ok = (r) => {
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data;
    };
    try {
      const school = ok(
          await f.record(
            "establishments",
            {
              name: "École Démonstration",
              country: "Burkina Faso",
              city: "Ouagadougou",
            },
            f.root,
          ),
        ),
        users = {};
      for (const role of [
        "administrator",
        "school_life",
        "accountant",
        "teacher",
        "student",
        "parent",
      ])
        users[role] = ok(
          await f.record(
            "school_users",
            {
              establishment_id: school.id,
              email: role + "@browser.invalid",
              emailVisibility: true,
              password: f.password,
              passwordConfirm: f.password,
              first_name: role,
              last_name: "Démo",
              role,
            },
            f.root,
          ),
        );
      const admin = (await f.login("administrator@browser.invalid")).token;
      const year = ok(
          await f.record(
            "academic_years",
            {
              establishment_id: school.id,
              label: "2026–2027",
              starts_on: "2026-09-01 00:00:00Z",
              ends_on: "2027-07-31 00:00:00Z",
              is_active: true,
            },
            admin,
          ),
        ),
        cl = ok(
          await f.record(
            "classes",
            {
              establishment_id: school.id,
              academic_year_id: year.id,
              name: "3e A",
              capacity: 20,
            },
            admin,
          ),
        ),
        subject = ok(await f.state(admin)).subjects.find(
          (x) => x.name === "Mathématiques",
        );
      assert.ok(subject);
      ok(
        await f.record(
          "enrollments",
          {
            establishment_id: school.id,
            student_id: users.student.id,
            academic_year_id: year.id,
            class_id: cl.id,
            enrolled_on: "2026-10-18",
            registration_fee: 10000,
            tuition_fee: 90000,
          },
          admin,
        ),
      );
      ok(
        await f.action(admin, "parent-link", {
          parent: users.parent.id,
          student: users.student.id,
        }),
      );
      ok(
        await f.action(admin, "period", {
          year: year.id,
          label: "Trimestre 1",
          starts_on: "2026-09-01",
          ends_on: "2026-12-31",
        }),
      );
      browser = await chromium.launch({
        executablePath: process.env.CHROME_BIN,
        headless: true,
        args: ["--no-sandbox"],
      });
      const errors = [];
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(f.base);
      await page
        .getByLabel("Email ou matricule")
        .fill("administrator@browser.invalid");
      await page.getByLabel("Mot de passe", { exact: true }).fill(f.password);
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Inscriptions & paiements", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Classes", exact: true }).click();
      await page
        .getByRole("heading", { name: "Classes", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Inscriptions & paiements", exact: true })
        .click();
      await page.getByRole("button", { name: "Notes", exact: true }).click();
      await page
        .getByRole("heading", { name: "Notes & évaluations", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Inscriptions & paiements", exact: true })
        .click();
      await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
      let form = page.locator("form[data-action=payments]");
      await form.locator("[name=amount]").fill("30000");
      page.once("dialog", (d) => d.accept());
      await form
        .getByRole("button", { name: "Enregistrer le versement", exact: true })
        .click();
      await page
        .getByText(
          "Versement enregistré. Aucun débit bancaire n’a été effectué.",
          { exact: true },
        )
        .waitFor();
      await page.getByText("Partiel", { exact: true }).waitFor();
      await page.evaluate(
        () => (window.print = () => (window.__printed = true)),
      );
      await page
        .getByRole("button", { name: "Imprimer", exact: true })
        .first()
        .click();
      assert.equal(await page.evaluate(() => window.__printed), true);
      await page
        .getByRole("button", {
          name: "Pédagogie & communications",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Classes", exact: true }).click();
      await page
        .getByRole("heading", { name: "Classes", exact: true })
        .waitFor();
      assert.match(await page.locator("#class-detail").innerText(), /3e A/);
      assert.match(
        await page.locator("#class-detail").innerText(),
        /Élèves inscrits \(1\)/,
      );
      await page
        .getByRole("button", {
          name: "Consulter les notes de cette classe",
          exact: true,
        })
        .click();
      await page.locator("#grades-class").waitFor();
      assert.equal(
        await page.locator("#grades-class").getAttribute("id"),
        "grades-class",
      );
      await page
        .getByRole("button", { name: "Organisation pédagogique", exact: true })
        .click();
      form = page.locator("form[data-operation=assignment]");
      await form.waitFor();
      assert.equal(
        await form.locator("select[name=subject] option").count(),
        15,
      );
      await form.locator("[name=teacher]").selectOption(users.teacher.id);
      await form.locator("[name=classroom]").selectOption(cl.id);
      await form.locator("[name=subject]").selectOption(subject.id);
      await form.locator("[name=coefficient]").fill("2");
      await form.locator("[type=submit]").click();
      await page.getByText("Opération enregistrée", { exact: true }).waitFor();
      assert.equal(ok(await f.state(admin)).assignments.length, 1);
      await page
        .getByRole("button", { name: "Emploi du temps", exact: true })
        .click();
      await page.locator("details").filter({ has: page.locator("form[data-operation=timetable]") }).evaluate((el) => (el.open = true));
      form = page.locator("form[data-operation=timetable]");
      await form.locator("[name=weekday]").selectOption("1");
      await form.locator("[name=start_time]").fill("08:00");
      await form.locator("[name=end_time]").fill("09:00");
      await form.locator("[name=room]").fill("Salle A");
      await form.locator("[name=week_type]").selectOption("odd");
      await form.locator("[type=submit]").click();
      await page.locator("#timetable-printable").getByText("08:00–09:00", { exact: true }).waitFor();
      await page.getByRole("cell", { name: "Semaines impaires", exact: true }).waitFor();
      assert.match(
        await page.locator("#timetable-printable").innerText(),
        /Mathématiques.*Salle A/s,
      );
      await page
        .getByRole("button", { name: "Imprimer l’emploi du temps", exact: true })
        .click();
      assert.match(
        await page.locator("#school-printout").innerText(),
        /Emploi du temps.*Lundi.*Mathématiques/s,
      );
      assert.equal(await page.locator("#school-printout").count(), 1);
      assert.equal(await page.locator("#payment-receipt").count(), 0, "An old receipt must not be included with the timetable");
      await page.locator("details").filter({ has: page.locator("#document-preferences") }).evaluate((el) => (el.open = true));
      let preferences = page.locator("#document-preferences");
      await preferences
        .locator('[name="accent"]')
        .evaluate((input) => (input.value = "#0f766e"));
      await preferences
        .locator('[name="subtitle"]')
        .fill("Année scolaire 2026–2027");
      await preferences.locator('[type="submit"]').click();
      await page
        .getByText("Présentation des documents enregistrée sur cet appareil.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.locator("#timetable-printable").getAttribute("style").then((x) => x.includes("#0f766e")),
        true,
      );
      assert.match(
        await page.locator("#timetable-printable").innerText(),
        /Année scolaire 2026–2027/,
      );
      await page.locator("details").filter({ has: page.locator("form[data-operation=timetable]") }).evaluate((el) => (el.open = true));
      form = page.locator("form[data-operation=timetable]");
      await form.locator("[name=start_time]").fill("08:30");
      await form.locator("[name=end_time]").fill("09:30");
      await form.locator("[type=submit]").click();
      await page
        .getByText("Conflit de classe, enseignant ou salle.", { exact: true })
        .waitFor();
      const initialSlot = ok(await f.state(admin)).timetable[0];
      await page.locator(`[data-edit-slot="${initialSlot.id}"]`).click();
      form = page.locator("form[data-operation=timetable]");
      assert.equal(await form.locator('[name="id"]').inputValue(), initialSlot.id);
      assert.equal(await form.locator('[name="room"]').inputValue(), "Salle A");
      await form.locator('[name="room"]').fill("Salle B");
      await form.locator('[name="end_time"]').fill("07:00");
      await form.getByRole("button", { name: "Enregistrer les modifications", exact: true }).click();
      await page.getByText("Heures invalides.", { exact: true }).waitFor();
      assert.equal(await form.locator('[name="id"]').inputValue(), initialSlot.id);
      assert.equal(await form.locator('[name="room"]').inputValue(), "Salle B");
      assert.equal(await form.locator('[name="end_time"]').inputValue(), "07:00");
      assert.equal(ok(await f.state(admin)).timetable[0].room, "Salle A");
      await form.locator('[name="end_time"]').fill("09:00");
      await form.getByRole("button", { name: "Enregistrer les modifications", exact: true }).click();
      await page.locator("#timetable-printable").getByText("Salle B", { exact: true }).waitFor();
      const editedSlots = ok(await f.state(admin)).timetable;
      assert.equal(editedSlots.length, 1, "Editing must update the existing slot, not create another");
      assert.equal(editedSlots[0].id, initialSlot.id);
      assert.equal(editedSlots[0].room, "Salle B");
      assert.equal(await page.locator('form[data-operation=timetable] [name="id"]').count(), 0);
      await page.locator(`[data-edit-slot="${initialSlot.id}"]`).click();
      form = page.locator("form[data-operation=timetable]");
      await form.locator('[name="room"]').fill("Modification abandonnée");
      await form.locator("[data-cancel-slot-edit]").click();
      assert.equal(await form.locator('[name="id"]').count(), 0);
      assert.equal(await form.locator('[name="room"]').inputValue(), "");
      assert.equal(await form.locator('[type="submit"]').textContent(), "Enregistrer");
      assert.equal(ok(await f.state(admin)).timetable[0].room, "Salle B");
      await page
        .getByRole("button", { name: "Notes & évaluations", exact: true })
        .click();
      form = page.locator("form[data-operation=evaluation]");
      await form.locator("[name=title]").fill("Contrôle navigateur");
      await form.locator("[name=held_on]").fill("2026-10-18");
      await form.locator("[type=submit]").click();
      await page
        .getByText("Contrôle navigateur", { exact: true })
        .first()
        .waitFor();
      form = page.locator("form[data-operation=grade]");
      await form.locator("[name=score]").fill("18");
      await form.locator("[type=submit]").click();
      await page.getByText("18 / 20", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Publier", exact: true }).click();
      await page.getByText("Publiée", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Bulletins", exact: true })
        .click();
      await page.locator("#school-report .report-summary").waitFor();
      assert.match(
        await page.locator("#school-report .report-summary").innerText(),
        /Moyenne générale[\s\S]*18\.00[\s\S]*Rang[\s\S]*1er sur 1 élève classé[\s\S]*Mention[\s\S]*Excellent/,
      );
      await page
        .getByRole("button", { name: "Imprimer le bulletin", exact: true })
        .click();
      assert.match(
        await page.locator("#school-printout").textContent(),
        /18.00/,
      );
      const classmate = ok(await f.record("school_users", {
        establishment_id: school.id,
        email: "classmate@browser.invalid",
        password: f.password,
        passwordConfirm: f.password,
        first_name: "Camarade",
        last_name: "Bulletin",
        role: "student",
      }, f.root));
      ok(await f.record("enrollments", {
        establishment_id: school.id,
        student_id: classmate.id,
        academic_year_id: year.id,
        class_id: cl.id,
        enrolled_on: "2026-10-18",
        registration_fee: 10000,
        tuition_fee: 90000,
      }, admin));
      const savedComment = "Très bon travail & progrès <à confirmer>";
      ok(await f.action(admin, "report-comment", {
        student: users.student.id,
        period: await page.locator("#report-period").inputValue(),
        comment: savedComment,
      }));
      await page.getByRole("button", { name: "Bulletins", exact: true }).click();
      await page.locator(`#report-student option[value="${classmate.id}"]`).waitFor({ state: "attached" });
      await page.locator("#report-student").selectOption(users.student.id);
      await page.locator('form[data-operation="report-comment"] textarea').waitFor();
      assert.equal(await page.locator('form[data-operation="report-comment"] textarea').inputValue(), savedComment);
      const selectedReportStudent = await page.locator("#report-student").inputValue();
      await page.getByRole("button", { name: "Imprimer les bulletins de la classe", exact: true }).click();
      assert.equal(await page.locator("#school-printout").count(), 1);
      assert.equal(await page.locator("#payment-receipt").count(), 0);
      const classReports = page.locator("#school-printout .class-report-page");
      assert.equal(await classReports.count(), 2);
      const reportNames = await classReports.locator(".report-student-card > div:first-child strong").allTextContents();
      assert.deepEqual(reportNames, ["Camarade Bulletin", "student Démo"]);
      assert.match(await classReports.first().textContent(), /Bulletin scolaire/);
      assert.match(await classReports.nth(1).textContent(), /18\.00/);
      assert.equal(await page.locator("#report-student").inputValue(), selectedReportStudent);
      assert.equal(await page.locator("#school-report").count(), 1);
      preferences = page.locator("#document-preferences");
      await preferences.locator('[name="showRank"]').uncheck();
      await preferences.locator('[type="submit"]').click();
      await page
        .getByText("Présentation des documents enregistrée sur cet appareil.", {
          exact: true,
        })
        .waitFor();
      assert.doesNotMatch(await page.locator("#school-report").innerText(), /Rang/);
      const french = ok(await f.state(admin)).subjects.find(
        (x) => x.name === "Français",
      );
      const classB = ok(
        await f.record(
          "classes",
          {
            establishment_id: school.id,
            academic_year_id: year.id,
            name: "3e B",
            capacity: 20,
          },
          admin,
        ),
      );
      const frenchAssignment = ok(
        await f.action(admin, "assignment", {
          teacher: users.teacher.id,
          classroom: cl.id,
          subject: french.id,
          coefficient: 1,
        }),
      );
      const otherAssignment = ok(
        await f.action(admin, "assignment", {
          teacher: users.teacher.id,
          classroom: classB.id,
          subject: subject.id,
          coefficient: 2,
        }),
      );
      const term = ok(await f.state(admin)).periods[0];
      const frenchEvaluation = ok(
        await f.action(admin, "evaluation", {
          assignment: frenchAssignment.id,
          period: term.id,
          title: "Dictée de français",
          held_on: "2026-10-19",
          maximum: 20,
          weight: 1,
        }),
      );
      ok(
        await f.action(admin, "grade", {
          evaluation: frenchEvaluation.id,
          student: users.student.id,
          status: "graded",
          score: 12,
          comment: "Exemple français",
        }),
      );
      ok(
        await f.action(admin, "evaluation", {
          assignment: otherAssignment.id,
          period: term.id,
          title: "Contrôle classe B",
          held_on: "2026-10-19",
          maximum: 20,
          weight: 1,
        }),
      );
      await page
        .getByRole("button", { name: "Notes & évaluations", exact: true })
        .click();
      await page.locator("#grades-class").selectOption(cl.id);
      await page.locator("#grades-subject").selectOption(subject.id);
      await page
        .locator("#grade-groups")
        .getByText("18 / 20", { exact: true })
        .waitFor();
      assert.ok(
        !(await page.locator("#grade-groups").innerText()).includes(
          "Dictée de français",
        ),
      );
      const completedPeriod = ok(
        await f.action(admin, "period", {
          year: year.id,
          label: "Période clôturée",
          starts_on: "2026-09-01",
          ends_on: "2026-10-01",
        }),
      );
      ok(
        await f.action(admin, "evaluation", {
          assignment: frenchAssignment.id,
          period: completedPeriod.id,
          title: "Évaluation clôturée",
          held_on: "2026-09-20",
          maximum: 20,
          weight: 1,
        }),
      );
      ok(
        await f.action(admin, "lock-period", {
          id: completedPeriod.id,
          locked: true,
        }),
      );
      await page
        .getByRole("button", { name: "Organisation pédagogique", exact: true })
        .click();
      await page.getByText("Clôturée", { exact: true }).first().waitFor();
      await page
        .getByRole("button", { name: "Notes & évaluations", exact: true })
        .click();
      await page.locator("#grades-class").selectOption(cl.id);
      await page.locator("#grades-period").selectOption(completedPeriod.id);
      await page
        .getByRole("heading", { name: "Période clôturée", exact: true })
        .waitFor();
      assert.equal(
        await page.locator('form[data-operation="grade"]').count(),
        0,
      );
      const openPeriod = ok(await f.state(admin)).periods.find(
        (x) => x.label === "Trimestre 1",
      );
      await page.locator("#grades-period").selectOption(openPeriod.id);
      assert.ok(
        !(await page.locator("#grade-groups").innerText()).includes(
          "Contrôle classe B",
        ),
      );
      await page.locator("#grades-subject").selectOption(french.id);
      await page
        .locator("#grade-groups")
        .getByText("Dictée de français", { exact: true })
        .waitFor();
      assert.match(await page.locator("#grade-groups").innerText(), /12 \/ 20/);
      assert.ok(
        !(await page.locator("#grade-groups").innerText()).includes(
          "Contrôle navigateur",
        ),
      );
      await page.locator("#grades-class").selectOption(classB.id);
      await page
        .locator("#grade-groups")
        .getByText("Contrôle classe B", { exact: true })
        .waitFor();
      assert.ok(
        !(await page.locator("#grade-groups").innerText()).includes(
          "Dictée de français",
        ),
      );
      await page.locator("#grades-class").selectOption("");
      assert.equal(await page.locator("[data-grade-class]").count(), 2);
      await page.screenshot({
        path: "/tmp/etudia-notes-classe-matiere.png",
        fullPage: true,
      });
      const oldYear = ok(
        await f.record(
          "academic_years",
          {
            establishment_id: school.id,
            label: "2025–2026",
            starts_on: "2025-09-01 00:00:00Z",
            ends_on: "2026-07-31 00:00:00Z",
          },
          admin,
        ),
      );
      const oldClass = ok(
        await f.record(
          "classes",
          {
            establishment_id: school.id,
            academic_year_id: oldYear.id,
            name: "3e A",
            capacity: 20,
          },
          admin,
        ),
      );
      const oldPeriod = ok(
        await f.action(admin, "period", {
          year: oldYear.id,
          label: "Trimestre 1",
          starts_on: "2025-09-01",
          ends_on: "2025-12-31",
        }),
      );
      const oldAssignment = ok(
        await f.action(admin, "assignment", {
          teacher: users.teacher.id,
          classroom: oldClass.id,
          subject: subject.id,
          coefficient: 2,
        }),
      );
      ok(
        await f.action(admin, "evaluation", {
          assignment: oldAssignment.id,
          period: oldPeriod.id,
          title: "Contrôle année précédente",
          held_on: "2025-10-14",
          maximum: 20,
          weight: 1,
        }),
      );
      await page
        .getByRole("button", { name: "Notes & évaluations", exact: true })
        .click();
      await page.locator("#grades-class").selectOption(oldClass.id);
      await page
        .locator("#grade-groups")
        .getByText("Contrôle année précédente", { exact: true })
        .waitFor();
      assert.ok(
        !(await page.locator("#grade-groups").innerText()).includes(
          "Contrôle navigateur",
        ),
      );
      await page.locator("#grades-class").selectOption("");
      const oldForm = page.locator('form[data-operation="evaluation"]');
      await oldForm
        .locator('[name="assignment"]')
        .selectOption(oldAssignment.id);
      assert.equal(await oldForm.locator('[name="period"] option').count(), 1);
      assert.equal(
        await oldForm.locator('[name="period"] option').getAttribute("value"),
        oldPeriod.id,
      );

      await page.getByRole("button", { name: "Classes", exact: true }).click();
      await page
        .getByRole("button", { name: "Ouvrir 3e B", exact: true })
        .click();
      await page
        .locator("#class-detail")
        .getByRole("heading", { name: "Élèves inscrits (0)", exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Consulter les notes de cette classe",
          exact: true,
        })
        .click();
      assert.ok(
        (await page.locator("#grade-groups").innerText()).includes(
          "Contrôle classe B",
        ),
      );
      await page.locator("#grades-class").selectOption(cl.id);
      await page.getByRole("button", { name: "Classes", exact: true }).click();
      const classForm = page.locator('form[data-action="classes"]');
      await classForm.locator('[name="name"]').fill("3e C");
      await classForm.locator('[name="capacity"]').fill("25");
      await classForm.locator('[type="submit"]').click();
      await page
        .getByRole("button", { name: "Ouvrir 3e C", exact: true })
        .click();
      await page.locator("#class-detail summary").click();
      const editClass = page.locator('form[data-operation="edit-class"]');
      await editClass.locator('[name="name"]').fill("3e C2");
      await editClass.locator('[name="capacity"]').fill("32");
      await editClass.locator('[type="submit"]').click();
      await page
        .getByRole("button", { name: "Ouvrir 3e C2", exact: true })
        .waitFor();
      await page.screenshot({
        path: "/tmp/etudia-classes.png",
        fullPage: true,
      });
      const savedClass = ok(await f.state(admin)).classes.find(
        (c) => c.name === "3e C2",
      );
      assert.equal(savedClass.capacity, 32);
      await page
        .getByRole("button", { name: "Organisation pédagogique", exact: true })
        .click();
      form = page.locator("form[data-operation=import-students]");
      await form
        .locator("[name=csv]")
        .fill(
          "first_name;last_name;email;phone\nIssa;Kaboré;issa@browser.invalid;70000000",
        );
      const download = page.waitForEvent("download");
      await form.locator("[type=submit]").click();
      const dl = await download;
      assert.match(dl.suggestedFilename(), /identifiants/);
      await page.getByText("Opération enregistrée", { exact: true }).waitFor();
      const payload = '<img src=x onerror="window.__xss=true">';
      ok(
        await f.action(admin, "announcement", {
          title: "Test contenu",
          body: payload,
          audience: "all",
        }),
      );
      await page.getByRole("button", { name: "Annonces", exact: true }).click();
      await page.getByText(payload, { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__xss), undefined);
      assert.equal(await page.locator("#school-content img").count(), 0);
      for (const name of [
        "Tableau de bord",
        "Classes",
        "Devoirs & rendus",
        "Cahier de textes",
        "Emploi du temps",
        "Appel & absences",
        "Messagerie",
        "Scolarité & versements",
        "Compte & sécurité",
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
      }
      await page.screenshot({
        path: "/tmp/etudia-administration.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("button", { name: "Tableau de bord", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Tableau de bord", exact: true })
        .waitFor();
      await page.screenshot({ path: "/tmp/etudia-mobile.png", fullPage: true });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
      );
      const family = await context.newPage();
      family.on("pageerror", (e) => errors.push(e.message));
      await family.goto(f.base);
      await family
        .getByLabel("Email ou matricule")
        .fill("parent@browser.invalid");
      await family.getByLabel("Mot de passe", { exact: true }).fill(f.password);
      await family
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await family
        .getByRole("heading", { name: "Tableau de bord", exact: true })
        .waitFor();
      assert.equal(
        await family
          .getByRole("button", { name: "Classes", exact: true })
          .count(),
        0,
      );
      await family
        .getByRole("button", { name: "Notes & évaluations", exact: true })
        .click();
      await family.locator("#grade-groups").waitFor();
      assert.ok(
        !(await family.locator("#grade-groups").innerText()).includes(
          "Dictée de français",
        ),
      );
      await family
        .getByRole("button", { name: "Bulletins", exact: true })
        .click();
      await family
        .locator("#school-report .report-summary article").filter({ hasText: "Moyenne générale" }).getByText("18.00 /20", { exact: true })
        .waitFor();
      assert.equal(await family.locator("[data-operation=grade]").count(), 0);
      await family
        .getByRole("button", { name: "Scolarité & versements", exact: true })
        .click();
      await family.getByText("Partiel", { exact: false }).first().waitFor();
      const teacherPage = await context.newPage();
      teacherPage.on("pageerror", (e) => errors.push(e.message));
      await teacherPage.goto(f.base);
      await teacherPage
        .getByLabel("Email ou matricule")
        .fill("teacher@browser.invalid");
      await teacherPage
        .getByLabel("Mot de passe", { exact: true })
        .fill(f.password);
      await teacherPage
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await teacherPage
        .getByRole("heading", { name: "Tableau de bord", exact: true })
        .waitFor();
      await teacherPage
        .getByRole("button", { name: "Classes", exact: true })
        .click();
      await teacherPage.locator("#class-detail").waitFor();
      assert.equal(
        await teacherPage.locator('form[data-action="classes"]').count(),
        0,
      );
      assert.equal(
        await teacherPage.locator('form[data-operation="edit-class"]').count(),
        0,
      );
      assert.equal(
        await teacherPage
          .getByRole("button", { name: "Ouvrir 3e C2", exact: true })
          .count(),
        0,
      );
      await teacherPage
        .getByRole("button", { name: "Devoirs & rendus", exact: true })
        .click();
      let task = teacherPage.locator("form[data-operation=homework]");
      await task.locator("[name=title]").fill("Devoir navigateur");
      await task.locator("[name=instructions]").fill("Résoudre 2x=6");
      await task.locator("[name=due_on]").fill("2026-10-20");
      await task.locator("[type=submit]").click();
      await teacherPage
        .getByRole("heading", { name: "Devoir navigateur", exact: true })
        .waitFor();
      const studentPage = await context.newPage();
      studentPage.on("pageerror", (e) => errors.push(e.message));
      await studentPage.goto(f.base);
      await studentPage
        .getByLabel("Email ou matricule")
        .fill("student@browser.invalid");
      await studentPage
        .getByLabel("Mot de passe", { exact: true })
        .fill(f.password);
      await studentPage
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await studentPage
        .getByRole("heading", { name: "Tableau de bord", exact: true })
        .waitFor();
      await studentPage
        .getByRole("button", { name: "Devoirs & rendus", exact: true })
        .click();
      task = studentPage.locator("form[data-operation=submission]");
      await task.locator("[name=answer]").fill("x=3");
      await task.locator("[type=submit]").click();
      await studentPage.getByText("x=3", { exact: true }).waitFor();
      const registrarPage = await context.newPage();
      registrarPage.on("pageerror", (e) => errors.push(e.message));
      await registrarPage.goto(f.base);
      await registrarPage
        .getByLabel("Email ou matricule")
        .fill("school_life@browser.invalid");
      await registrarPage
        .getByLabel("Mot de passe", { exact: true })
        .fill(f.password);
      await registrarPage
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await registrarPage
        .getByRole("heading", { name: "Tableau de bord", exact: true })
        .waitFor();
      await registrarPage
        .getByRole("button", { name: "Classes", exact: true })
        .click();
      const personForm = registrarPage.locator(
        'form[data-operation="create-person"]',
      );
      await personForm.locator('[name="first_name"]').fill("Rokia");
      await personForm.locator('[name="last_name"]').fill("Nouveau");
      const credentialsDownload = registrarPage.waitForEvent("download");
      await personForm.getByRole("button", { name: /Créer le compte/ }).click();
      const credentials = await credentialsDownload;
      assert.match(
        require("node:fs").readFileSync(await credentials.path(), "utf8"),
        /Rokia/,
      );
      const createdStudent = ok(await f.state(admin)).people.find(
        (x) => x.first_name === "Rokia" && x.last_name === "Nouveau",
      );
      assert.ok(createdStudent);
      const enrollmentForm = registrarPage.locator(
        'form[data-operation="enrollment"]',
      );
      await enrollmentForm
        .locator('[name="student"]')
        .selectOption(createdStudent.id);
      await enrollmentForm.locator('[name="enrolled_on"]').fill("2026-10-20");
      await enrollmentForm.locator('[name="classroom"]').selectOption(cl.id);
      await registrarPage
        .locator("#notice")
        .evaluate((el) => (el.textContent = ""));
      await enrollmentForm
        .getByRole("button", { name: "Inscrire dans la classe" })
        .click();
      await registrarPage.waitForFunction(
        () => document.querySelector("#notice")?.textContent,
        null,
        { timeout: 5000 },
      );
      assert.equal(
        await registrarPage.locator("#notice").textContent(),
        "Opération enregistrée",
      );
      const afterRegistrarEnrollment = ok(await f.state(admin));
      const rokia = afterRegistrarEnrollment.people.find(
        (x) => x.first_name === "Rokia" && x.last_name === "Nouveau",
      );
      assert.ok(rokia);
      assert.ok(
        afterRegistrarEnrollment.enrollments.some(
          (x) => x.student_id === rokia.id,
        ),
      );
      await registrarPage.locator(`[data-open-class="${cl.id}"]`).click();
      await registrarPage
        .locator("#class-detail")
        .getByText("Rokia Nouveau", { exact: true })
        .waitFor();

      const accountantPage = await context.newPage();
      accountantPage.on("pageerror", (e) => errors.push(e.message));
      await accountantPage.goto(f.base);
      await accountantPage
        .getByLabel("Email ou matricule")
        .fill("accountant@browser.invalid");
      await accountantPage
        .getByLabel("Mot de passe", { exact: true })
        .fill(f.password);
      await accountantPage
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await accountantPage
        .getByRole("heading", { name: "Inscriptions & paiements", exact: true })
        .waitFor();
      assert.equal(
        await accountantPage.locator('form[data-action="enrollments"]').count(),
        0,
      );
      await accountantPage.locator("[data-enrollment]").first().click();
      await accountantPage.locator("#student-dossier").waitFor();
      assert.equal(
        await accountantPage
          .locator('form[data-action="enrollment-update"]')
          .count(),
        0,
      );
      assert.equal(
        await accountantPage
          .locator('form[data-operation="enrollment-fees"]')
          .count(),
        1,
      );
      assert.ok(
        await accountantPage.locator('form[data-action="payments"]').count(),
      );
      // Settings intentionally loads no grades, while export must include the
      // complete authorized dataset rather than that module's partial state.
      const stateRequests = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname === "/api/etudia/state") stateRequests.push(url.searchParams.get("page"));
      });
      await page.evaluate(async () => {
        adminPage = "workspace";
        schoolPage = "settings";
        await schoolWorkspace();
      });
      await page.locator("#export-school-json").waitFor();
      assert.equal(stateRequests.at(-1), "settings");
      assert.equal(await page.evaluate(() => schoolData.grades.length), 0);
      const exportDownload = page.waitForEvent("download");
      await page.locator("#export-school-json").click();
      const exported = JSON.parse(require("node:fs").readFileSync(await (await exportDownload).path(), "utf8"));
      assert.equal(stateRequests.at(-1), null);
      const complete = ok(await f.state(admin));
      assert.deepEqual(exported.grades, complete.grades);
      assert.ok(exported.grades.length > 0);
      assert.deepEqual(exported.payments, complete.payments);

      // A failed module load must remove stale data and support retry.
      await page.route("**/api/etudia/state?page=grades", (route) => route.fulfill({
        status: 503, contentType: "application/json", body: JSON.stringify({ message: "Indisponibilité de test" }),
      }), { times: 1 });
      await page.locator('[data-school-page="grades"]').click();
      await page.getByRole("heading", { name: "Chargement impossible" }).waitFor();
      assert.equal(await page.evaluate(() => schoolData), null);
      await page.getByRole("button", { name: "Réessayer", exact: true }).click();
      await page.locator("#grades-class").waitFor();
      assert.equal(stateRequests.at(-1), "grades");
      assert.equal(await page.locator("#app").getAttribute("aria-busy"), null);

      // A late module response cannot replace the finance page navigated to.
      let releaseResponse;
      const release = new Promise((resolve) => { releaseResponse = resolve; });
      let requestStarted;
      const started = new Promise((resolve) => { requestStarted = resolve; });
      await page.route("**/api/etudia/state?page=reports", async (route) => {
        const response = await route.fetch();
        requestStarted();
        await release;
        await route.fulfill({ response });
      }, { times: 1 });
      await page.locator('[data-school-page="reports"]').click();
      await started;
      await page.locator('[data-page="enrollments"]').click();
      await page.getByRole("heading", { name: "Inscriptions & paiements", exact: true }).waitFor();
      const lateResponse = page.waitForResponse((response) => response.url().endsWith("/api/etudia/state?page=reports"));
      releaseResponse();
      await lateResponse;
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await page.getByRole("heading", { name: "Inscriptions & paiements", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => schoolData), null);
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      await f.close();
    }
  },
);
