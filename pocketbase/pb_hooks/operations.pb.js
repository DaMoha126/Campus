routerAdd(
  "GET",
  "/api/etudia/state",
  (e) => e.json(200, require(__hooks + "/operations.cjs").state(e.app, e.auth)),
  $apis.requireAuth("school_users"),
);
routerAdd(
  "POST",
  "/api/etudia/action",
  (e) =>
    e.json(
      200,
      require(__hooks + "/operations.cjs").action(
        e.app,
        e.auth,
        e.requestInfo().body,
      ),
    ),
  $apis.requireAuth("school_users"),
  $apis.bodyLimit(65536),
);
routerUse((e) => {
  const host = e.request.host;
  const origin = e.request.header.get("Origin");
  const denied = require(__hooks + "/request-security.cjs").checkRequest(
    host, origin, $os.getenv("ETUDIA_PUBLIC_HOST") || $os.getenv("RENDER_EXTERNAL_HOSTNAME"),
  );
  if (denied) throw new ForbiddenError(denied);
  if (
    e.auth &&
    e.auth.collection().name === "school_users" &&
    e.auth.getBool("disabled")
  )
    throw new ForbiddenError("Compte désactivé.");
  e.response.header().set("Cache-Control", "no-store");
  e.response.header().set("Referrer-Policy", "no-referrer");
  const p = e.request.url.path;
  if (p === "/" || (/\.(js|css)$/.test(p) && !p.startsWith("/_/")))
    e.response
      .header()
      .set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
  return e.next();
});
onRecordCreate((e) => {
  if (!e.record.getString("login_id"))
    e.record.set("login_id", "E" + $security.randomString(10).toUpperCase());
  e.next();
}, "school_users");
