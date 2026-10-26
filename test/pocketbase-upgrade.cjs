const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  { DatabaseSync } = require("node:sqlite");
test(
  "PocketBase upgrade preserves existing school records",
  { skip: !process.env.POCKETBASE_BIN },
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "etudia-upgrade-"));
    try {
      const old = path.join(root, "old");
      fs.mkdirSync(old);
      const file = "1792256400_school_foundation.js";
      fs.copyFileSync(
        path.join("pocketbase/pb_migrations", file),
        path.join(old, file),
      );
      const data = path.join(root, "data");
      const migrate = (migrations) => {
        const r = spawnSync(
          process.env.POCKETBASE_BIN,
          [
            "migrate",
            "up",
            "--dev=false",
            "--dir=" + data,
            "--migrationsDir=" + path.resolve(migrations),
          ],
          { encoding: "utf8" },
        );
        assert.equal(r.status, 0, r.stderr);
      };
      migrate(old);
      const superuser = spawnSync(
        process.env.POCKETBASE_BIN,
        [
          "superuser",
          "create",
          "upgrade@fixture.invalid",
          require("node:crypto").randomBytes(20).toString("hex"),
          "--dir=" + data,
          "--migrationsDir=" + old,
          "--dev=false",
        ],
        { encoding: "utf8" },
      );
      assert.equal(superuser.status, 0, superuser.stderr);
      let db = new DatabaseSync(path.join(data, "data.db"));
      db.prepare(
        "INSERT INTO establishments(id,name,country,city) VALUES(?,?,?,?)",
      ).run(
        "preserved123456",
        "École existante",
        "Burkina Faso",
        "Ouagadougou",
      );
      const originalHash = db
        .prepare("SELECT password FROM _superusers LIMIT 1")
        .get().password;
      db.prepare(
        "INSERT INTO school_users(id,establishment_id,first_name,last_name,role,email,password,tokenKey) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        "student00000001",
        "preserved123456",
        "Ancien",
        "Compte",
        "student",
        "ancien@fixture.invalid",
        originalHash,
        "old-token-key-12345678901234567890",
      );
      db.prepare("INSERT INTO subjects(id,establishment_id,name) VALUES(?,?,?)").run("oldmath00000001", "preserved123456", "  maths  ");
      db.prepare("INSERT INTO subjects(id,establishment_id,name) VALUES(?,?,?)").run("oldsvt000000001", "preserved123456", "SVT");
      db.prepare("INSERT INTO subjects(id,establishment_id,name) VALUES(?,?,?)").run("custom000000001", "preserved123456", "Comptabilité");
      db.close();
      migrate("pocketbase/pb_migrations");
      migrate("pocketbase/pb_migrations");
      db = new DatabaseSync(path.join(data, "data.db"));
      assert.equal(
        db
          .prepare("SELECT name FROM establishments WHERE id=?")
          .get("preserved123456").name,
        "École existante",
      );
      assert.equal(db.prepare("SELECT COUNT(*) n FROM enrollments").get().n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM payments").get().n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM subjects").get().n, 16);
      assert.equal(db.prepare("SELECT name FROM subjects WHERE id='oldmath00000001'").get().name, "  maths  ");
      assert.equal(db.prepare("SELECT COUNT(*) n FROM subjects WHERE name='Mathématiques'").get().n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM subjects WHERE name='Comptabilité'").get().n, 1);
      const migrated = db
        .prepare("SELECT login_id,password,email FROM school_users WHERE id=?")
        .get("student00000001");
      assert.ok(migrated.login_id);
      assert.equal(migrated.password, originalHash);
      assert.equal(migrated.email, "ancien@fixture.invalid");
      db.close();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
