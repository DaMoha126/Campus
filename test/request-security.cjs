const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkRequest } = require("../pocketbase/pb_hooks/request-security.cjs");
test("public hostname is opt-in, exact and HTTPS origin only", () => {
  assert.equal(checkRequest("localhost:8090", "http://localhost:8090", ""), "");
  assert.equal(checkRequest("127.0.0.1:8090", "", "etudia.onrender.com"), "");
  assert.ok(checkRequest("evil.example", "", ""));
  assert.ok(checkRequest("etudia.onrender.com", "", ""));
  assert.equal(checkRequest("etudia.onrender.com", "https://etudia.onrender.com", "etudia.onrender.com"), "");
  assert.ok(checkRequest("etudia.onrender.com.evil.example", "", "etudia.onrender.com"));
  assert.ok(checkRequest("evil.example", "https://etudia.onrender.com", "etudia.onrender.com"));
  assert.ok(checkRequest("etudia.onrender.com", "http://etudia.onrender.com", "etudia.onrender.com"));
  assert.ok(checkRequest("etudia.onrender.com", "https://evil.example", "etudia.onrender.com"));
  assert.ok(checkRequest("etudia.onrender.com", "null", "etudia.onrender.com"));
  assert.ok(checkRequest("etudia.onrender.com", "", "*.onrender.com"));
  assert.ok(checkRequest("etudia.onrender.com", "", "https://etudia.onrender.com/path"));
});
