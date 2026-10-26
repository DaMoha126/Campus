let financeYear = "",
  selectedEnrollment = "";
const money = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) +
  " FCFA";
const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const fullName = (u) =>
  u ? u.first_name + " " + u.last_name : "Élève introuvable";
const methods = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  cheque: "Chèque",
};
const options = (items, value, label, selected = "") =>
  items
    .map(
      (x) =>
        `<option value="${esc(value(x))}" ${value(x) === selected ? "selected" : ""}>${esc(label(x))}</option>`,
    )
    .join("");
function balance(d, e) {
  const total = e.registration_fee + e.tuition_fee,
    paid = d.payments
      .filter(
        (p) =>
          p.enrollment_id === e.id &&
          !(d.reversals || []).some((r) => r.payment === p.id),
      )
      .reduce((s, p) => s + p.amount, 0);
  return {
    total,
    paid,
    due: total - paid,
    status:
      total === 0
        ? "Sans frais"
        : paid === 0
          ? "Non réglé"
          : paid === total
            ? "Soldé"
            : "Partiel",
  };
}
function financeScreen(d) {
  if (!d.years.some((y) => y.id === financeYear))
    financeYear = d.years.find((y) => y.is_active)?.id || d.years[0]?.id || "";
  const years = d.years,
    classes = d.classes.filter((c) => c.academic_year_id === financeYear),
    students = d.people.filter((u) => u.role === "student"),
    enrollments = d.enrollments.filter(
      (e) => e.academic_year_id === financeYear,
    );
  const chosen = enrollments.find((e) => e.id === selectedEnrollment);
  let totals = { total: 0, paid: 0, due: 0 };
  enrollments.forEach((e) => {
    const b = balance(d, e);
    totals.total += b.total;
    totals.paid += b.paid;
    totals.due += b.due;
  });
  const available = students.filter(
    (u) => !enrollments.some((e) => e.student_id === u.id),
  );
  return `<span class="badge">Scolarité · ${esc(d.school.name)}</span><h1>Inscriptions & paiements</h1><p>Inscrivez les élèves dans une classe et suivez les versements en FCFA.</p><label class="year-filter">Année scolaire<select id="finance-year">${options(
    years,
    (x) => x.id,
    (x) => x.label,
    financeYear,
  )}</select></label><div class="metrics"><div><strong>${enrollments.length}</strong><span>Élèves inscrits</span></div><div><strong>${money(totals.total)}</strong><span>Frais prévus</span></div><div><strong>${money(totals.paid)}</strong><span>Versements enregistrés</span></div><div><strong>${money(totals.due)}</strong><span>Reste à payer</span></div></div><div class="grid"><section class="panel"><h2>Nouvelle inscription</h2>${
    classes.length && available.length
      ? `<form data-action="enrollments"><input type="hidden" name="academic_year_id" value="${esc(financeYear)}"><label>Élève<select name="student_id" required>${options(available, (x) => x.id, fullName)}</select></label><label>Classe<select name="class_id" required>${options(
          classes,
          (x) => x.id,
          (x) =>
            x.name +
            " · " +
            enrollments.filter((e) => e.class_id === x.id).length +
            "/" +
            x.capacity,
        )}</select></label>${field("enrolled_on", "Date d’inscription", "date", `value="${today()}"`)}${field("registration_fee", "Frais d’inscription (FCFA)", "number", 'min="0" max="1000000000" step="1" value="0"')}${field("tuition_fee", "Scolarité annuelle (FCFA)", "number", 'min="0" max="1000000000" step="1" value="0"')}<button type="submit">Inscrire et affecter à la classe</button></form>`
      : `<p class="empty">${!years.length ? "Créez une année scolaire." : !classes.length ? "Créez une classe pour cette année." : !students.length ? "Créez un compte de rôle Élève." : "Tous les élèves ont déjà une inscription pour cette année."}</p><button data-page="structure">Ouvrir Classes & comptes</button>`
  }</section><section class="panel"><h2>Versements et dossier élève</h2><p>Sélectionnez un élève dans le registre ci-dessous pour enregistrer un versement, consulter son historique ou changer sa classe.</p><p class="empty">Les versements sont enregistrés manuellement. Cette fonction ne prélève aucun argent sur un compte bancaire ou Mobile Money.</p></section><section class="panel wide"><div class="section-head"><h2>Registre des inscriptions</h2><button id="export-enrollments">Exporter CSV</button></div><label>Rechercher un élève ou une classe<input id="enrollment-search" type="search" placeholder="Nom, prénom ou classe"></label><div class="table-wrap"><table><thead><tr><th>Élève</th><th>Classe</th><th>Inscription</th><th>Total dû</th><th>Payé</th><th>Reste</th><th>État</th><th>Dossier</th></tr></thead><tbody>${enrollments
    .map((e) => {
      const u = d.people.find((u) => u.id === e.student_id),
        c = d.classes.find((c) => c.id === e.class_id),
        b = balance(d, e);
      return `<tr data-enrollment-row data-search="${esc((fullName(u) + " " + (c?.name || "")).toLocaleLowerCase("fr"))}"><td>${esc(fullName(u))}</td><td>${esc(c?.name || "")}</td><td>${esc(e.enrolled_on)}</td><td>${money(b.total)}</td><td>${money(b.paid)}</td><td>${money(b.due)}</td><td><span class="badge">${b.status}</span></td><td><button data-enrollment="${e.id}">Ouvrir</button></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table>${enrollments.length ? "" : '<p class="empty">Aucune inscription pour cette année.</p>'}</div></section>${chosen ? enrollmentDetail(d, chosen) : ""}</div>`;
}
function enrollmentDetail(d, e) {
  const b = balance(d, e),
    u = d.people.find((u) => u.id === e.student_id),
    payments = d.payments
      .filter((p) => p.enrollment_id === e.id)
      .sort(
        (a, b) =>
          b.paid_on.localeCompare(a.paid_on) ||
          b.created.localeCompare(a.created),
      );
  return `<section class="panel wide" id="student-dossier"><h2>Dossier de ${esc(fullName(u))}</h2><p>${esc(d.years.find((y) => y.id === e.academic_year_id)?.label)} · ${money(b.paid)} payés sur ${money(b.total)} · <b>Reste : ${money(b.due)}</b></p><div class="grid"><div><h3>Enregistrer un versement</h3>${
    b.due > 0
      ? `<form data-action="payments"><input type="hidden" name="enrollment_id" value="${e.id}"><input type="hidden" name="request_key" value="${crypto.randomUUID()}">${field("amount", "Montant reçu (FCFA)", "number", `min="1" max="${b.due}" step="1"`)}${field("paid_on", "Date du versement", "date", `value="${today()}"`)}<label>Mode de paiement<select name="method">${Object.entries(
          methods,
        )
          .map(([v, l]) => `<option value="${v}">${l}</option>`)
          .join(
            "",
          )}</select></label><label>Référence ou remarque (facultative)<input name="reference" maxlength="200"></label><button type="submit">Enregistrer le versement</button></form>`
      : "<p>Le dossier est soldé ou ne comporte aucun frais.</p>"
  }</div><div><h3>Classe et frais prévus</h3><form data-action="enrollment-update"><input type="hidden" name="id" value="${e.id}"><label>Classe<select name="class_id">${options(
    d.classes.filter((c) => c.academic_year_id === e.academic_year_id),
    (x) => x.id,
    (x) => x.name,
    e.class_id,
  )}</select></label>${field("enrolled_on", "Date d’inscription", "date", `value="${esc(e.enrolled_on)}"`)}${field("registration_fee", "Frais d’inscription (FCFA)", "number", `min="0" max="1000000000" step="1" value="${e.registration_fee}"`)}${field("tuition_fee", "Scolarité annuelle (FCFA)", "number", `min="0" max="1000000000" step="1" value="${e.tuition_fee}"`)}<button type="submit">Mettre à jour le dossier</button></form></div></div><h3>Échéancier</h3>${opForm("deadline", hidden("enrollment", e.id) + field("label", "Libellé : tranche 1") + field("due_on", "Échéance", "date") + field("amount", "Montant prévu (FCFA)", "number", 'min="1" max="2000000000" step="1"'), "Ajouter une échéance")}${table(
    ["Échéance", "Libellé", "Montant prévu", "Action"],
    (d.deadlines || [])
      .filter((x) => x.enrollment === e.id)
      .sort((a, b) => a.due_on.localeCompare(b.due_on))
      .map((x) => [
        esc(x.due_on),
        esc(x.label),
        money(x.amount),
        opButton(
          "delete-item",
          { entity: "payment_deadlines", id: x.id },
          "Retirer",
        ),
      ]),
  )}<h3>Historique des versements</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th><th>Agent</th><th>Reçu / correction</th></tr></thead><tbody>${payments.map((p) => `<tr><td>${esc(p.paid_on)}</td><td>${money(p.amount)}</td><td>${methods[p.method]}</td><td>${esc(p.reference || "—")}</td><td>${esc(fullName(d.people.find((u) => u.id === p.recorded_by)))}</td><td><button data-receipt="${p.id}">Imprimer</button>${(d.reversals || []).some((r) => r.payment === p.id) ? '<span class="badge">Annulé</span>' : opForm("reverse-payment", hidden("payment", p.id) + area("reason", "Motif de correction", 2000), "Annuler ce versement")}</td></tr>`).join("")}</tbody></table>${payments.length ? "" : '<p class="empty">Aucun versement enregistré.</p>'}</div><p class="empty">Un versement erroné peut être annulé avec un motif. La trace d’origine reste conservée ; aucun remboursement bancaire n’est effectué.</p></section>`;
}
document.addEventListener("click", async (event) => {
  const page = event.target.closest("[data-page]");
  if (page) {
    adminPage = page.dataset.page;
    await start();
    return;
  }
  const row = event.target.closest("[data-enrollment]");
  if (row) {
    selectedEnrollment = row.dataset.enrollment;
    await start();
    document
      .querySelector("#student-dossier")
      ?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const receipt = event.target.closest("[data-receipt]");
  if (receipt) {
    printReceipt(receipt.dataset.receipt);
    return;
  }
  if (event.target.closest("#export-enrollments")) exportEnrollments();
});
document.addEventListener("change", async (event) => {
  if (event.target.id === "finance-year") {
    financeYear = event.target.value;
    selectedEnrollment = "";
    await start();
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "enrollment-search") {
    const q = event.target.value.trim().toLocaleLowerCase("fr");
    document
      .querySelectorAll("[data-enrollment-row]")
      .forEach((r) => (r.hidden = !r.dataset.search.includes(q)));
  }
});
function exportEnrollments() {
  const d = latestData;
  const rows = [
    [
      "Élève",
      "Année",
      "Classe",
      "Date inscription",
      "Frais inscription FCFA",
      "Scolarité FCFA",
      "Total FCFA",
      "Payé FCFA",
      "Reste FCFA",
      "État",
    ],
  ];
  d.enrollments
    .filter((e) => e.academic_year_id === financeYear)
    .forEach((e) => {
      const b = balance(d, e);
      rows.push([
        fullName(d.people.find((u) => u.id === e.student_id)),
        d.years.find((y) => y.id === e.academic_year_id)?.label,
        d.classes.find((c) => c.id === e.class_id)?.name,
        e.enrolled_on,
        e.registration_fee,
        e.tuition_fee,
        b.total,
        b.paid,
        b.due,
        b.status,
      ]);
    });
  const safe = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^\s*[=+@\-]|^[\t\r\n]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(safe).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "etudia-inscriptions.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printReceipt(id) {
  const d = latestData,
    p = d.payments.find((p) => p.id === id);
  if (!p) return;
  document.querySelector("#payment-receipt")?.remove();
  const e = d.enrollments.find((e) => e.id === p.enrollment_id),
    el = document.createElement("section");
  el.id = "payment-receipt";
  el.innerHTML = `<h1>${esc(d.school.name)}</h1><h2>Reçu de versement ${(d.reversals || []).some((r) => r.payment === p.id) ? "— ANNULÉ" : ""}</h2><p>N° ${esc(p.id)}</p><p>Élève : ${esc(fullName(d.people.find((u) => u.id === e.student_id)))}</p><p>Année scolaire : ${esc(d.years.find((y) => y.id === e.academic_year_id)?.label)}</p><p>Date : ${esc(p.paid_on)}</p><p><b>Montant reçu : ${money(p.amount)}</b></p><p>Mode : ${methods[p.method]}</p><p>Référence : ${esc(p.reference || "—")}</p><p>Enregistré par : ${esc(fullName(d.people.find((u) => u.id === p.recorded_by)))}</p><p>Ce reçu atteste du versement enregistré manuellement dans Étudia.</p>`;
  document.body.append(el);
  window.print();
}
