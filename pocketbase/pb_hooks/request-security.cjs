// Public access is opt-in and restricted to the exact deployment hostname.
function checkRequest(host, origin, publicHost) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const configured = typeof publicHost === "string" ? publicHost.trim().toLowerCase() : "";
  const valid = /^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(configured)
    && configured.indexOf(".") !== -1 && !configured.includes("..");
  const remote = valid && host === configured;
  if (!local && !remote) return "Hôte refusé.";
  if (origin && origin !== "https://" + host && !(local && origin === "http://" + host))
    return "Origine refusée.";
  return "";
}
module.exports = { checkRequest };
