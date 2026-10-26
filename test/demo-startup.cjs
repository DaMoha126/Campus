const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
test(
  "free demo seeds fictitious accounts, shows warning and survives a fresh filesystem",
  { skip: !process.env.POCKETBASE_BIN },
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "etudia-demo-test-"));
    const data = path.join(dir, "etudia-demo-data"),
      password = require("node:crypto").randomBytes(24).toString("hex");
    let proc,
      browser,
      logs = "";
    const stop = async () => {
      if (proc && proc.exitCode === null)
        await new Promise((r) => {
          proc.once("exit", r);
          proc.kill();
        });
    };
    const base = "http://127.0.0.1:31370";
    try {
      fs.copyFileSync(process.env.POCKETBASE_BIN, path.join(dir, "pocketbase"));
      fs.chmodSync(path.join(dir, "pocketbase"), 0o700);
      for (const name of ["pb_migrations", "pb_hooks", "pb_public"])
        fs.symlinkSync(path.resolve("pocketbase", name), path.join(dir, name));
      fs.writeFileSync(
        path.join(dir, "start.sh"),
        fs
          .readFileSync("scripts/start-cloud.sh", "utf8")
          .replaceAll("/app/", dir + "/"),
      );
      const start = async () => {
        proc = spawn("sh", [path.join(dir, "start.sh")], {
          env: {
            ...process.env,
            PORT: "31370",
            ETUDIA_DEMO: "1",
            ETUDIA_DATA_DIR: data,
            ETUDIA_DEMO_PASSWORD: password,
            RENDER_EXTERNAL_HOSTNAME: "etudia-demo-test.onrender.com",
          },
        });
        proc.stdout.on("data", (x) => (logs += x));
        proc.stderr.on("data", (x) => (logs += x));
        for (let i = 0; i < 6000; i++) {
          try {
            if ((await fetch(base + "/api/health")).ok) return;
          } catch {}
          if (proc.exitCode !== null) throw Error(logs);
          await new Promise((r) => setTimeout(r, 30));
        }
        throw Error("Demo startup timeout: " + logs);
      };
      const state = async (identity) => {
        let login;
        for (let attempt = 0; attempt < 5; attempt++) {
          login = await fetch(
            base + "/api/collections/school_users/auth-with-password",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identity, password }),
            },
          );
          if (login.status !== 429) break;
          await new Promise((r) => setTimeout(r, 1500));
        }

        assert.equal(login.status, 200, await login.clone().text());
        const auth = await login.json();
        const r = await fetch(base + "/api/etudia/state", {
          headers: { Authorization: auth.token },
        });
        assert.equal(r.status, 200);
        return r.json();
      };
      await start();
      assert.deepEqual(
        await (await fetch(base + "/api/etudia/config")).json(),
        { demo: true },
      );
      const admin = await state("DEMOADMIN");
      assert.equal(admin.subjects.length, 15);
      assert.equal(admin.people.length, 69);
      assert.equal(admin.assignments.length, 12);
      assert.equal(admin.timetable.length, 12);
      assert.equal(admin.classes.length, 4);
      assert.equal(admin.enrollments.length, 40);
      assert.equal(admin.grades.length, 240);
      assert.equal(admin.people.filter((x) => x.role === "student").length, 40);
      assert.equal(admin.people.filter((x) => x.role === "parent").length, 20);
      assert.equal(admin.people.filter((x) => x.role === "teacher").length, 6);
      assert.equal(
        admin.people.filter((x) => x.role === "administrator").length,
        3,
      );
      const school2 = await state("DEMOADMIN2"),
        school3 = await state("DEMOADMIN3");
      assert.notEqual(school2.school.id, admin.school.id);
      assert.notEqual(school3.school.id, school2.school.id);
      for (const other of [school2, school3]) {
        assert.equal(other.people.length, 69);
        assert.equal(other.enrollments.length, 40);
        assert.ok(
          !other.people.some((p) => admin.people.some((a) => a.id === p.id)),
        );
        assert.ok(
          !other.grades.some((g) => admin.grades.some((a) => a.id === g.id)),
        );
      }
      assert.ok(admin.payments.length > 0);
      assert.ok(admin.reversals.length > 0);
      assert.ok(admin.attendance.length > 0);
      assert.ok(admin.evaluations.some((x) => !x.published));
      const principal = admin.people.find((x) => x.login_id === "DEMOELEVE");
      assert.ok(principal);
      assert.equal(
        admin.grades.filter((x) => x.student === principal.id).length,
        6,
      );
      assert.ok(
        admin.grades
          .filter((x) => x.student === principal.id)
          .every((x) => x.score === 16),
      );
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(path.join(data, "data.db"));
      assert.equal(
        db.prepare("SELECT COUNT(*) n FROM establishments").get().n,
        3,
      );
      assert.equal(
        db.prepare("SELECT COUNT(*) n FROM school_users").get().n,
        207,
      );
      assert.equal(
        db.prepare("SELECT COUNT(*) n FROM school_grades").get().n,
        720,
      );
      assert.equal(
        db
          .prepare(
            "SELECT COUNT(*) n FROM (SELECT establishment_id,first_name,last_name FROM school_users WHERE role='student' GROUP BY establishment_id,first_name,last_name HAVING COUNT(*)>1)",
          )
          .get().n,
        0,
        "Demo pupils must not reuse identical full names across classes",
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) n FROM parent_links l JOIN school_users p ON p.id=l.parent JOIN school_users s ON s.id=l.student WHERE p.establishment_id!=s.establishment_id OR p.establishment_id!=l.school OR p.role!='parent' OR s.role!='student'`,
          )
          .get().n,
        0,
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) n FROM teaching_assignments a JOIN school_users t ON t.id=a.teacher JOIN classes c ON c.id=a.classroom JOIN subjects s ON s.id=a.subject WHERE t.establishment_id!=a.school OR c.establishment_id!=a.school OR s.establishment_id!=a.school OR t.role!='teacher'`,
          )
          .get().n,
        0,
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) n FROM timetable_slots x JOIN timetable_slots y ON x.id<y.id AND x.school=y.school AND x.weekday=y.weekday AND x.start_time<y.end_time AND x.end_time>y.start_time JOIN teaching_assignments a ON a.id=x.assignment JOIN teaching_assignments b ON b.id=y.assignment WHERE a.teacher=b.teacher OR a.classroom=b.classroom OR x.room=y.room`,
          )
          .get().n,
        0,
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) n FROM enrollments e WHERE (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.enrollment_id=e.id AND NOT EXISTS (SELECT 1 FROM payment_reversals r WHERE r.payment=p.id)) > e.registration_fee+e.tuition_fee`,
          )
          .get().n,
        0,
      );
      db.close();
      for (const id of ["DEMOPROF", "DEMOELEVE", "DEMOPARENT"]) {
        const scoped = await state(id);
        assert.ok(scoped.evaluations.length > 0);
        if (id !== "DEMOPROF")
          assert.ok(scoped.evaluations.every((x) => x.published));
        if (id === "DEMOPARENT") {
          assert.equal(scoped.enrollments.length, 2);
          assert.equal(scoped.grades.length, 12);
        }
        if (id === "DEMOELEVE") {
          assert.equal(scoped.enrollments.length, 1);
          assert.equal(scoped.grades.length, 6);
        }
      }
      await new Promise((r) => setTimeout(r, 3500));
      if (process.env.CHROME_BIN) {
        const { chromium } = require(
          process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright",
        );
        browser = await chromium.launch({
          executablePath: process.env.CHROME_BIN,
          headless: true,
          args: ["--no-sandbox"],
        });
        const page = await browser.newPage();
        await page.goto(base);
        await page.locator("#demo-banner").waitFor({ state: "visible" });
        await page.getByLabel("Email ou matricule").fill("DEMOADMIN");
        await page.getByLabel("Mot de passe", { exact: true }).fill(password);
        const response = page.waitForResponse((r) =>
          r.url().includes("auth-with-password"),
        );
        await page
          .getByRole("button", { name: "Se connecter", exact: true })
          .click();
        assert.equal((await response).status(), 200);
        await page
          .getByRole("heading", {
            name: "Inscriptions & paiements",
            exact: true,
          })
          .waitFor();
        await page
          .getByRole("button", {
            name: "Pédagogie & communications",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Notes & évaluations", exact: true })
          .click();
        const fullName = (p) => p.first_name + " " + p.last_name;
        let previousNames = [];
        for (const classroom of admin.classes) {
          await page.locator("#grades-class").selectOption(classroom.id);
          const studentIds = admin.enrollments
            .filter((e) => e.class_id === classroom.id)
            .map((e) => e.student_id);
          const expected = admin.people.filter((p) =>
            studentIds.includes(p.id),
          );
          const shownNames = await page
            .locator("#grade-groups .student-name")
            .allTextContents();
          assert.deepEqual(
            [...new Set(shownNames)].sort(),
            expected.map(fullName).sort(),
          );
          assert.ok(
            shownNames.every((name) => !previousNames.includes(name)),
            "Switching classes must replace the displayed names",
          );
          const shownIds = await page
            .locator("#grade-groups [data-grade-student]")
            .evaluateAll((nodes) =>
              nodes.map((n) => n.getAttribute("data-grade-student")),
            );
          assert.deepEqual([...new Set(shownIds)].sort(), studentIds.sort());
          const options = await page
            .locator('form[data-operation="grade"] [name="student"] option')
            .evaluateAll((nodes) =>
              nodes.map((n) => ({ id: n.value, label: n.textContent })),
            );
          assert.deepEqual(options.map((o) => o.id).sort(), studentIds.sort());
          assert.ok(
            options.every((o) =>
              expected.some(
                (p) => p.id === o.id && o.label.includes(p.login_id),
              ),
            ),
          );
          previousNames = [...new Set(shownNames)];
        }
        await page
          .getByRole("button", { name: "Bulletins", exact: true })
          .click();
        await page.locator("#report-student").selectOption(principal.id);
        await page
          .locator("#report-period")
          .selectOption(
            admin.periods.find((x) => x.label === "Trimestre 1").id,
          );
        await page
          .getByText("Moyenne générale : 16.00 /20", { exact: true })
          .waitFor();
        await browser.close();
        browser = null;
      }
      await stop();
      await start();
      assert.equal((await state("DEMOADMIN")).people.length, 69);
      await stop();
      fs.rmSync(data, { recursive: true, force: true });
      await start();
      const fresh = await state("DEMOADMIN");
      assert.equal(fresh.people.length, 69);
      assert.notEqual(fresh.school.id, admin.school.id);
      assert.ok(!logs.includes(password));
    } finally {
      if (browser) await browser.close();
      await stop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
