const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fixture = require("../support/pocketbase-fixture.cjs");
test(
  "school workflows and adversarial security suite",
  { skip: !process.env.POCKETBASE_BIN },
  async (t) => {
    const f = await fixture(31361);
    const { record, req, action, state, root, password } = f;
    let a,
      b,
      users = {},
      tokens = {},
      year,
      cl,
      otherClass,
      subject,
      as,
      period,
      ev,
      hw,
      att,
      ins,
      pay;
    const ok = (r, status = 200) => {
      assert.equal(r.status, status, JSON.stringify(r.data));
      return r.data;
    };
    const denied = (r) =>
      assert.ok(
        [400, 401, 403, 404, 409].includes(r.status),
        JSON.stringify(r),
      );
    try {
      await t.test("fixtures and authentication boundaries", async () => {
        a = ok(
          await record(
            "establishments",
            { name: "École Alpha", country: "Burkina Faso" },
            root,
          ),
        );
        b = ok(
          await record(
            "establishments",
            { name: "École Beta", country: "Burkina Faso" },
            root,
          ),
        );
        for (const [key, role, school] of [
          ["admin", "administrator", a.id],
          ["registrar", "school_life", a.id],
          ["accountant", "accountant", a.id],
          ["teacher", "teacher", a.id],
          ["teacher2", "teacher", a.id],
          ["student", "student", a.id],
          ["student2", "student", a.id],
          ["parent", "parent", a.id],
          ["parent2", "parent", a.id],
          ["foreign", "administrator", b.id],
        ]) {
          users[key] = ok(
            await record(
              "school_users",
              {
                email: key + "@fixture.invalid",
                password,
                passwordConfirm: password,
                first_name: key,
                last_name: "Test",
                role,
                establishment_id: school,
              },
              root,
            ),
          );
          tokens[key] = (await f.login(key + "@fixture.invalid")).token;
        }
        denied(await state());
        denied(await state("forged.jwt.token"));
        denied(await action(tokens.student, "assignment", {}));
        year = ok(
          await record(
            "academic_years",
            {
              establishment_id: a.id,
              label: "2026–2027",
              starts_on: "2026-09-01 00:00:00Z",
              ends_on: "2027-07-31 00:00:00Z",
            },
            tokens.admin,
          ),
        );
        cl = ok(
          await record(
            "classes",
            {
              establishment_id: a.id,
              academic_year_id: year.id,
              name: "3e A",
              capacity: 10,
            },
            tokens.admin,
          ),
        );
        otherClass = ok(
          await record(
            "classes",
            {
              establishment_id: a.id,
              academic_year_id: year.id,
              name: "3e B",
              capacity: 10,
            },
            tokens.admin,
          ),
        );
        const catalog = ok(await state(tokens.admin)).subjects;
        assert.equal(catalog.length, 15);
        subject = catalog.find((x) => x.name === "Mathématiques");
        assert.ok(subject);
        const foreignCatalog = ok(await state(tokens.foreign)).subjects;
        assert.equal(foreignCatalog.length, 15);
        assert.ok(!foreignCatalog.some((x) => x.id === subject.id));
        const registrarState = ok(await state(tokens.registrar));
        const accountantState = ok(await state(tokens.accountant));
        assert.equal(registrarState.permissions.schoolLife, true);
        assert.equal(registrarState.permissions.finance, false);
        assert.equal(accountantState.permissions.finance, true);
        assert.equal(accountantState.permissions.academics, false);
        assert.equal(
          Object.hasOwn(registrarState.enrollments[0] || {}, "tuition_fee"),
          false,
        );
        assert.equal(accountantState.grades.length, 0);
        denied(
          await action(tokens.accountant, "edit-class", {
            id: "not-a-real-id",
            name: "Intrusion",
            capacity: 1,
          }),
        );
        denied(
          await action(tokens.registrar, "reverse-payment", {
            payment: "not-a-real-id",
            reason: "test",
          }),
        );
        ins = ok(
          await record(
            "enrollments",
            {
              establishment_id: a.id,
              academic_year_id: year.id,
              class_id: cl.id,
              student_id: users.student.id,
              enrolled_on: "2026-10-18",
              registration_fee: 10000,
              tuition_fee: 90000,
            },
            tokens.admin,
          ),
        );
        ok(
          await record(
            "enrollments",
            {
              establishment_id: a.id,
              academic_year_id: year.id,
              class_id: otherClass.id,
              student_id: users.student2.id,
              enrolled_on: "2026-10-18",
            },
            tokens.admin,
          ),
        );
      });
      await t.test(
        "scolarité and comptabilité stay within their assigned permissions",
        async () => {
          const created = ok(
            await action(tokens.registrar, "create-person", {
              first_name: "Aïcha",
              last_name: "Nouveau",
              role: "student",
              email: "",
              phone: "",
            }),
          );
          assert.match(created.credentials[0].login_id, /^E/);
          assert.equal(created.credentials[0].password.length, 12);
          denied(
            await action(tokens.registrar, "create-person", {
              first_name: "Nouvel",
              last_name: "Enseignant",
              role: "teacher",
            }),
          );
          const student = ok(
            await req(
              "collections/school_users/records?filter=" +
                encodeURIComponent(
                  "login_id='" + created.credentials[0].login_id + "'",
                ),
              undefined,
              tokens.admin,
            ),
          ).items[0];
          const enrolled = ok(
            await action(tokens.registrar, "enrollment", {
              student: student.id,
              classroom: otherClass.id,
              year: year.id,
              enrolled_on: "2026-10-18",
            }),
          );
          assert.ok(enrolled.id);
          const registrarState = ok(await state(tokens.registrar));
          const accountState = ok(await state(tokens.accountant));
          assert.equal(
            accountState.people.some((x) => "email" in x || "phone" in x),
            false,
          );
          const registrarEnrollment = registrarState.enrollments.find(
            (x) => x.id === enrolled.id,
          );
          assert.ok(registrarEnrollment);
          assert.equal(
            Object.hasOwn(registrarEnrollment, "tuition_fee"),
            false,
          );
          assert.equal(
            accountState.enrollments.find((x) => x.id === enrolled.id)
              .tuition_fee,
            0,
          );
          ok(
            await action(tokens.accountant, "enrollment-fees", {
              enrollment: enrolled.id,
              registration_fee: 500,
              tuition_fee: 1500,
            }),
          );
          assert.equal(
            ok(await state(tokens.accountant)).enrollments.find(
              (x) => x.id === enrolled.id,
            ).tuition_fee,
            1500,
          );
          denied(
            await action(tokens.registrar, "enrollment-fees", {
              enrollment: enrolled.id,
              registration_fee: 0,
              tuition_fee: 0,
            }),
          );
          denied(
            await action(tokens.accountant, "enrollment", {
              student: student.id,
              classroom: otherClass.id,
              year: year.id,
              enrolled_on: "2026-10-18",
            }),
          );
          denied(
            await action(tokens.registrar, "import-students", {
              classroom: otherClass.id,
              csv: "first_name;last_name;email;phone\nTest;Montant;testmontant@fixture.invalid;",
              enrolled_on: "2026-10-18",
              registration_fee: 100,
              tuition_fee: 0,
            }),
          );
          assert.equal(
            (
              await req(
                "collections/payments/records",
                undefined,
                tokens.accountant,
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "teacher assignments and parent links enforce school and role",
        async () => {
          denied(
            await action(tokens.admin, "assignment", {
              teacher: users.foreign.id,
              classroom: cl.id,
              subject: subject.id,
              coefficient: 1,
            }),
          );
          denied(
            await action(tokens.admin, "assignment", {
              teacher: users.student.id,
              classroom: cl.id,
              subject: subject.id,
              coefficient: 1,
            }),
          );
          as = ok(
            await action(tokens.admin, "assignment", {
              teacher: users.teacher.id,
              classroom: cl.id,
              subject: subject.id,
              coefficient: 2,
            }),
          );
          ok(
            await action(tokens.admin, "parent-link", {
              parent: users.parent.id,
              student: users.student.id,
            }),
          );
          denied(
            await action(tokens.parent, "parent-link", {
              parent: users.parent.id,
              student: users.student2.id,
            }),
          );
          assert.equal(ok(await state(tokens.parent)).enrollments.length, 1);
          assert.equal(ok(await state(tokens.parent2)).enrollments.length, 0);
          assert.equal(ok(await state(tokens.teacher2)).enrollments.length, 0);
          assert.equal(
            ok(await state(tokens.teacher)).enrollments[0].tuition_fee,
            undefined,
          );
        },
      );
      await t.test(
        "periods, grades, publishing and mass assignment protection",
        async () => {
          period = ok(
            await action(tokens.admin, "period", {
              year: year.id,
              label: "Trimestre 1",
              starts_on: "2026-09-01",
              ends_on: "2026-12-31",
            }),
          );
          denied(
            await action(tokens.admin, "period", {
              year: year.id,
              label: "Invalid",
              starts_on: "2026-02-30",
              ends_on: "2026-12-31",
            }),
          );
          denied(
            await action(tokens.teacher2, "evaluation", {
              assignment: as.id,
              period: period.id,
              title: "Fraude",
              held_on: "2026-10-18",
              maximum: 20,
              weight: 1,
            }),
          );
          ev = ok(
            await action(tokens.teacher, "evaluation", {
              assignment: as.id,
              period: period.id,
              title: "Contrôle 1",
              held_on: "2026-10-18",
              maximum: 20,
              weight: 2,
              published: true,
              school: b.id,
            }),
          );
          assert.equal(ok(await state(tokens.student)).evaluations.length, 0);
          denied(
            await action(tokens.student, "grade", {
              evaluation: ev.id,
              student: users.student.id,
              status: "graded",
              score: 20,
            }),
          );
          denied(
            await action(tokens.teacher, "grade", {
              evaluation: ev.id,
              student: users.student2.id,
              status: "graded",
              score: 20,
            }),
          );
          denied(
            await action(tokens.teacher, "grade", {
              evaluation: ev.id,
              student: users.student.id,
              status: "graded",
              score: 21,
            }),
          );
          ok(
            await action(tokens.teacher, "grade", {
              evaluation: ev.id,
              student: users.student.id,
              status: "graded",
              score: 16,
              comment: "Bon travail",
            }),
          );
          assert.equal(ok(await state(tokens.parent)).grades.length, 0);
          ok(
            await action(tokens.teacher, "publish-evaluation", {
              id: ev.id,
              published: true,
            }),
          );
          assert.equal(ok(await state(tokens.parent)).grades[0].score, 16);
          assert.equal(ok(await state(tokens.parent2)).grades.length, 0);
          assert.equal(ok(await state(tokens.student2)).grades.length, 0);
          denied(
            await req(
              "collections/school_grades/records",
              { score: 20 },
              tokens.student,
            ),
          );
          denied(
            await req(
              "collections/school_grades/records/" + ev.id,
              { score: 20 },
              tokens.student,
              "PATCH",
            ),
          );
        },
      );
      await t.test(
        "devoirs, submissions, feedback and lesson log",
        async () => {
          hw = ok(
            await action(tokens.teacher, "homework", {
              assignment: as.id,
              title: "Équations",
              instructions: "Résoudre 2x+4=10",
              due_on: "2026-10-20",
            }),
          );
          denied(
            await action(tokens.student2, "submission", {
              homework: hw.id,
              answer: "intrusion",
            }),
          );
          ok(
            await action(tokens.student, "submission", {
              homework: hw.id,
              answer: "x=3",
              feedback: "usurped",
              student: users.student2.id,
            }),
          );
          let sub = ok(await state(tokens.teacher)).submissions[0];
          assert.equal(sub.feedback, "");
          ok(
            await action(tokens.teacher, "feedback", {
              id: sub.id,
              feedback: "Correct",
            }),
          );
          assert.equal(
            ok(await state(tokens.parent)).submissions[0].feedback,
            "Correct",
          );
          denied(
            await action(tokens.teacher2, "feedback", {
              id: sub.id,
              feedback: "intrusion",
            }),
          );
          ok(
            await action(tokens.teacher, "lesson", {
              assignment: as.id,
              title: "Équations",
              held_on: "2026-10-18",
              content: "Méthode de résolution",
            }),
          );
          assert.equal(ok(await state(tokens.student)).lessons.length, 1);
        },
      );
      await t.test(
        "timetable conflicts and attendance justifications",
        async () => {
          ok(
            await action(tokens.admin, "timetable", {
              assignment: as.id,
              weekday: 1,
              start_time: "08:00",
              end_time: "09:00",
              room: "A1",
            }),
          );
          denied(
            await action(tokens.admin, "timetable", {
              assignment: as.id,
              weekday: 1,
              start_time: "08:30",
              end_time: "09:30",
              room: "A2",
            }),
          );
          denied(
            await action(tokens.admin, "timetable", {
              assignment: as.id,
              weekday: 1,
              start_time: "09:00",
              end_time: "08:00",
            }),
          );
          att = ok(
            await action(tokens.teacher, "attendance", {
              assignment: as.id,
              student: users.student.id,
              held_on: "2026-10-18",
              status: "absent",
              minutes: 0,
            }),
          );
          denied(
            await action(tokens.teacher, "attendance", {
              assignment: as.id,
              student: users.student2.id,
              held_on: "2026-10-18",
              status: "present",
            }),
          );
          denied(
            await action(tokens.parent2, "absence-request", {
              attendance: att.id,
              reason: "Fraude",
            }),
          );
          let ar = ok(
            await action(tokens.parent, "absence-request", {
              attendance: att.id,
              reason: "Maladie",
            }),
          );
          denied(
            await action(tokens.parent, "absence-review", {
              id: ar.id,
              status: "accepted",
            }),
          );
          ok(
            await action(tokens.admin, "absence-review", {
              id: ar.id,
              status: "accepted",
            }),
          );
          assert.equal(
            ok(await state(tokens.student)).attendance[0].justified,
            true,
          );
        },
      );
      await t.test("private messages and targeted announcements", async () => {
        ok(
          await action(tokens.admin, "announcement", {
            title: "Parents uniquement",
            body: "Réunion",
            audience: "parent",
          }),
        );
        assert.equal(ok(await state(tokens.student)).announcements.length, 0);
        assert.equal(ok(await state(tokens.parent)).announcements.length, 1);
        const msg = ok(
          await action(tokens.parent, "message", {
            recipient: users.teacher.id,
            subject: "Question",
            body: "Bonjour",
            sender: users.admin.id,
            school: b.id,
          }),
        );
        assert.equal(
          ok(await state(tokens.teacher)).messages[0].sender,
          users.parent.id,
        );
        assert.equal(ok(await state(tokens.admin)).messages.length, 0);
        denied(await action(tokens.student2, "message-read", { id: msg.id }));
        ok(await action(tokens.teacher, "message-read", { id: msg.id }));
        assert.equal(ok(await state(tokens.parent)).messages[0].read, true);
        denied(
          await action(tokens.parent, "message", {
            recipient: users.foreign.id,
            subject: "X",
            body: "X",
          }),
        );
      });
      await t.test(
        "payment correction, deadlines and immutable audit",
        async () => {
          pay = ok(
            await record(
              "payments",
              {
                establishment_id: a.id,
                enrollment_id: ins.id,
                recorded_by: users.admin.id,
                amount: 60000,
                paid_on: "2026-10-18",
                method: "cash",
                request_key: "unique-key",
              },
              tokens.admin,
            ),
          );
          const cashierPay = ok(
            await record(
              "payments",
              {
                establishment_id: a.id,
                enrollment_id: ins.id,
                recorded_by: users.accountant.id,
                amount: 1,
                paid_on: "2026-10-18",
                method: "cash",
                request_key: "cashier-role-payment",
              },
              tokens.accountant,
            ),
          );
          assert.equal(cashierPay.recorded_by, users.accountant.id);
          denied(
            await record(
              "payments",
              {
                establishment_id: a.id,
                enrollment_id: ins.id,
                recorded_by: users.registrar.id,
                amount: 1,
                paid_on: "2026-10-18",
                method: "cash",
                request_key: "registrar-role-payment",
              },
              tokens.registrar,
            ),
          );
          ok(
            await action(tokens.accountant, "reverse-payment", {
              payment: cashierPay.id,
              reason: "Test du droit comptable",
            }),
          );
          ok(
            await action(tokens.accountant, "deadline", {
              enrollment: ins.id,
              label: "Tranche 1",
              due_on: "2026-10-20",
              amount: 100000,
            }),
          );
          denied(
            await action(tokens.admin, "deadline", {
              enrollment: ins.id,
              label: "Trop",
              due_on: "2026-11-20",
              amount: 1,
            }),
          );
          denied(
            await action(tokens.parent, "reverse-payment", {
              payment: pay.id,
              reason: "Fraude",
            }),
          );
          ok(
            await action(tokens.admin, "reverse-payment", {
              payment: pay.id,
              reason: "Erreur de saisie",
            }),
          );
          denied(
            await action(tokens.admin, "reverse-payment", {
              payment: pay.id,
              reason: "Double annulation",
            }),
          );
          ok(
            await record(
              "payments",
              {
                establishment_id: a.id,
                enrollment_id: ins.id,
                recorded_by: users.admin.id,
                amount: 100000,
                paid_on: "2026-10-18",
                method: "cash",
                request_key: "corrected-payment",
              },
              tokens.admin,
            ),
          );
          denied(
            await req(
              "collections/enrollments/records/" + ins.id,
              { registration_fee: 0, tuition_fee: 1 },
              tokens.admin,
              "PATCH",
            ),
          );
          assert.equal(ok(await state(tokens.parent)).reversals.length, 2);
          assert.equal(ok(await state(tokens.foreign)).payments.length, 0);
          assert.equal(ok(await state(tokens.parent)).audit.length, 0);
          assert.ok(ok(await state(tokens.admin)).audit.length > 10);
          denied(
            await record("school_audit", { action: "forged" }, tokens.admin),
          );
        },
      );
      await t.test(
        "injection, cross-origin requests and forged role attacks",
        async () => {
          const before = ok(await state(tokens.student));
          for (const id of [
            "' OR 1=1 --",
            "../_superusers",
            "<script>alert(1)</script>",
            users.foreign.id,
          ])
            denied(
              await action(tokens.admin, "reset-password", {
                user: id,
                password: "12345678",
              }),
            );
          for (const operation of [
            "assignment",
            "parent-link",
            "period",
            "announcement",
            "activate-year",
            "disable-user",
            "reset-password",
            "reverse-payment",
            "delete-item",
          ])
            denied(
              await action(tokens.student, operation, {
                id: ev.id,
                user: users.admin.id,
                password: "12345678",
                entity: "school_users",
              }),
            );
          denied(
            await req(
              "etudia/action",
              { operation: "message", data: {} },
              tokens.admin,
              undefined,
              { Origin: "https://evil.invalid" },
            ),
          );
          denied(
            await action(tokens.admin, "constructor", {
              role: "administrator",
            }),
          );
          assert.equal(
            (
              await req(
                "etudia/action",
                { operation: "message", data: { body: "x".repeat(70000) } },
                tokens.admin,
              )
            ).status,
            413,
          );
          const after = ok(await state(tokens.student));
          assert.deepEqual(after.grades, before.grades);
          assert.ok(!JSON.stringify(after).includes(password));
          const page = await fetch(f.base);
          assert.match(
            page.headers.get("content-security-policy"),
            /script-src 'self'/,
          );
        },
      );

      await t.test(
        "CSV import is atomic and transfer history stays visible",
        async () => {
          const imported = ok(
            await action(tokens.admin, "import-students", {
              classroom: cl.id,
              csv: "first_name;last_name;email;phone\nAwa;Test;awa@fixture.invalid;70000000",
              enrolled_on: "2026-10-18",
              registration_fee: 0,
              tuition_fee: 50000,
            }),
          );
          assert.equal(imported.credentials.length, 1);
          assert.equal(imported.credentials[0].password.length, 12);
          assert.ok(imported.credentials[0].login_id);
          assert.ok(
            ok(
              await req("collections/school_users/auth-with-password", {
                identity: imported.credentials[0].login_id,
                password: imported.credentials[0].password,
              }),
            ).token,
          );
          const noEmail = ok(
            await action(tokens.admin, "import-students", {
              classroom: cl.id,
              csv: "first_name;last_name;email;phone\nSans;Email;;",
              enrolled_on: "2026-10-18",
              registration_fee: 0,
              tuition_fee: 0,
            }),
          );
          assert.ok(
            ok(
              await req("collections/school_users/auth-with-password", {
                identity: noEmail.credentials[0].login_id,
                password: noEmail.credentials[0].password,
              }),
            ).token,
          );
          const before = ok(await state(tokens.admin)).people.length;
          denied(
            await action(tokens.admin, "import-students", {
              classroom: cl.id,
              csv: "first_name;last_name;email;phone\nAvant;Erreur;rollback@fixture.invalid;\nDoublon;Test;awa@fixture.invalid;",
              enrolled_on: "2026-10-18",
              registration_fee: 0,
              tuition_fee: 0,
            }),
          );
          assert.equal(ok(await state(tokens.admin)).people.length, before);
          const transfer = await req(
            "collections/enrollments/records/" + ins.id,
            { class_id: otherClass.id, previous_classes: [users.foreign.id] },
            tokens.admin,
            "PATCH",
          );
          ok(transfer);
          assert.deepEqual(transfer.data.previous_classes, [cl.id]);
          assert.equal(ok(await state(tokens.parent)).grades[0].score, 16);
          const result = await new Promise((resolve, reject) => {
            const r = require("node:http").request(
              f.base + "/api/etudia/state",
              {
                headers: { Host: "evil.invalid", Authorization: tokens.admin },
              },
              (res) => {
                res.resume();
                res.on("end", () => resolve(res.statusCode));
              },
            );
            r.on("error", reject);
            r.end();
          });
          assert.equal(result, 403);
        },
      );
      await t.test(
        "disable tokens, password reset, current-password proof",
        async () => {
          ok(
            await action(tokens.admin, "disable-user", {
              user: users.student2.id,
              disabled: true,
            }),
          );
          denied(await state(tokens.student2));
          denied(
            await req(
              "collections/school_users/records/" + users.student2.id,
              undefined,
              tokens.student2,
            ),
          );
          denied(
            await req("collections/school_users/auth-with-password", {
              identity: "student2@fixture.invalid",
              password,
            }),
          );
          ok(
            await action(tokens.admin, "disable-user", {
              user: users.student2.id,
              disabled: false,
            }),
          );
          denied(
            await action(tokens.admin, "disable-user", {
              user: users.admin.id,
              disabled: true,
            }),
          );
          denied(
            await action(tokens.student, "change-password", {
              current_password: "wrong",
              password: "12345678",
            }),
          );
          ok(
            await action(tokens.admin, "reset-password", {
              user: users.student2.id,
              password: "NewPass123",
            }),
          );
          denied(await state(tokens.student2));
          const changed = ok(
            await req("collections/school_users/auth-with-password", {
              identity: "student2@fixture.invalid",
              password: "NewPass123",
            }),
          );
          assert.ok(changed.token);
        },
      );

      await t.test(
        "default authentication throttles repeated password guesses",
        async () => {
          const settings = ok(await req("settings", undefined, root));
          ok(
            await req(
              "settings",
              { rateLimits: { ...settings.rateLimits, enabled: true } },
              root,
              "PATCH",
            ),
          );
          const statuses = [];
          for (let i = 0; i < 15; i++)
            statuses.push(
              (
                await req("collections/school_users/auth-with-password", {
                  identity: "unknown@fixture.invalid",
                  password: "wrong-password",
                })
              ).status,
            );
          assert.ok(statuses.includes(429), statuses.join(","));
        },
      );
    } catch (e) {
      console.error(f.logs().slice(-5000));
      throw e;
    } finally {
      await f.close();
    }
  },
);
