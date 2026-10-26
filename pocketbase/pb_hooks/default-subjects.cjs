function seedSubjects(app, schoolId) {
  const defaults = [["Français", "Francais"], ["Mathématiques", "Maths", "Mathématique", "Mathematiques"], ["Anglais"], ["Histoire-Géographie", "Histoire Géographie", "Histoire et géographie", "HG"], ["Sciences de la vie et de la Terre", "SVT"], ["Physique-Chimie", "Physique Chimie", "Sciences physiques", "PC"], ["Philosophie"], ["Éducation physique et sportive", "EPS"], ["Éducation civique et morale", "ECM", "Éducation civique"], ["Informatique"], ["Technologie"], ["Allemand"], ["Espagnol"], ["Arts plastiques", "Dessin"], ["Éducation musicale", "Musique"]];
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const existing = app.findRecordsByFilter("subjects", "establishment_id={:school}", "", 0, 0, { school: schoolId });
  const names = existing.map((r) => normalize(r.getString("name")));
  const collection = app.findCollectionByNameOrId("subjects");
  for (const entry of defaults) {
    if (entry.some((name) => names.indexOf(normalize(name)) !== -1)) continue;
    const record = new Record(collection);
    record.set("establishment_id", schoolId);
    record.set("name", entry[0]);
    app.save(record);
    names.push(normalize(entry[0]));
  }
}
module.exports = { seedSubjects };
