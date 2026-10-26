module.exports = function (csv) {
  if (typeof csv !== "string" || csv.length > 50000)
    throw new BadRequestError(
      "CSV trop volumineux (50 000 caractères maximum).",
    );
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  csv = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ";" && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some((x) => x)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new BadRequestError("Guillemets CSV non fermés.");
  row.push(value.trim());
  if (row.some((x) => x)) rows.push(row);
  if (rows.length < 2 || rows.length > 101)
    throw new BadRequestError("Importez entre 1 et 100 élèves.");
  const header = rows.shift();
  if (header.join(";") !== "first_name;last_name;email;phone")
    throw new BadRequestError(
      "En-tête attendu : first_name;last_name;email;phone",
    );
  return rows.map((r) => {
    if (r.length !== 4)
      throw new BadRequestError("Chaque ligne doit comporter 4 colonnes.");
    return { first_name: r[0], last_name: r[1], email: r[2], phone: r[3] };
  });
};
