const { spawn, spawnSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
module.exports = async function (port) {
  const binary = process.env.POCKETBASE_BIN,
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "etudia-audit-")),
    password = crypto.randomBytes(24).toString("hex"),
    base = "http://127.0.0.1:" + port;
  const args = [
    "--dir=" + dir,
    "--migrationsDir=" + path.resolve("pocketbase/pb_migrations"),
    "--hooksDir=" + path.resolve("pocketbase/pb_hooks"),
    "--publicDir=" + path.resolve("pocketbase/pb_public"),
    "--dev=false",
    "--automigrate=false",
  ];
  const init = spawnSync(
    binary,
    ["superuser", "create", "root@fixture.invalid", password, ...args],
    { encoding: "utf8" },
  );
  if (init.status !== 0) throw Error(init.stderr);
  let logs = "";
  const proc = spawn(binary, ["serve", "--http=127.0.0.1:" + port, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr.on("data", (x) => (logs += x));
  proc.stdout.on("data", (x) => (logs += x));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (proc.exitCode !== null) throw Error(logs);
    await new Promise((r) => setTimeout(r, 30));
  }
  const req = async (route, body, token, method, headers = {}) => {
    const r = await fetch(base + "/api/" + route, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    return { status: r.status, data, headers: r.headers };
  };
  const record = (n, b, t) => req("collections/" + n + "/records", b, t);
  const login = async (email) => {
    const r = await req("collections/school_users/auth-with-password", {
      identity: email,
      password,
    });
    if (r.status !== 200)
      throw Error("Login " + email + " " + JSON.stringify(r.data));
    return r.data;
  };
  const root = (
    await req("collections/_superusers/auth-with-password", {
      identity: "root@fixture.invalid",
      password,
    })
  ).data.token;
  const settings = await req("settings", undefined, root);
  if (!settings.data.rateLimits.enabled)
    throw Error("Rate limiting must be enabled by migration");
  await req(
    "settings",
    { rateLimits: { ...settings.data.rateLimits, enabled: false } },
    root,
    "PATCH",
  );
  return {
    base,
    password,
    req,
    record,
    login,
    root,
    logs: () => logs,
    action: (token, operation, data) =>
      req("etudia/action", { operation, data }, token),
    state: (token) => req("etudia/state", undefined, token),
    async close() {
      if (proc.exitCode === null)
        await new Promise((r) => {
          proc.once("exit", r);
          proc.kill();
        });
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};
