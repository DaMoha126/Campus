function date(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new BadRequestError("Date invalide.");
}
function paid(app, id) {
  const result = new DynamicModel({ total: 0 });
  app
    .db()
    .newQuery(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments p WHERE enrollment_id={:id} AND NOT EXISTS (SELECT 1 FROM payment_reversals r WHERE r.payment=p.id)",
    )
    .bind({ id })
    .one(result);
  return result.total;
}
module.exports = {
  enrollment(e) {
    e.app.runInTransaction((tx) => {
      e.app = tx;
      const r = e.record,
        school = r.getString("establishment_id");
      const student = tx.findRecordById(
        "school_users",
        r.getString("student_id"),
      );
      const year = tx.findRecordById(
        "academic_years",
        r.getString("academic_year_id"),
      );
      const classroom = tx.findRecordById("classes", r.getString("class_id"));
      if (
        student.getString("role") !== "student" ||
        student.getString("establishment_id") !== school ||
        year.getString("establishment_id") !== school ||
        classroom.getString("establishment_id") !== school ||
        classroom.getString("academic_year_id") !== year.id
      )
        throw new BadRequestError(
          "L’élève, la classe et l’année doivent appartenir au même établissement et à la même année scolaire.",
        );
      if (r.isNew()) r.set("previous_classes", []);
      if (!r.isNew()) {
        const old = r.original();
        r.set(
          "previous_classes",
          Array.from(
            new Set([
              ...old.getStringSlice("previous_classes"),
              ...(old.getString("class_id") !== r.getString("class_id")
                ? [old.getString("class_id")]
                : []),
            ]),
          ),
        );
        for (const k of ["establishment_id", "student_id", "academic_year_id"])
          if (old.getString(k) !== r.getString(k))
            throw new BadRequestError(
              "L’élève, l’établissement et l’année d’une inscription ne peuvent pas être changés.",
            );
      }
      date(r.getString("enrolled_on"));
      for (const key of ["registration_fee", "tuition_fee"]) {
        const v = r.getFloat(key);
        if (!Number.isSafeInteger(v) || v < 0 || v > 1000000000)
          throw new BadRequestError(
            "Les frais doivent être des montants entiers positifs ou nuls en FCFA.",
          );
      }
      const count = new DynamicModel({ total: 0 });
      tx.db()
        .newQuery(
          "SELECT COUNT(*) AS total FROM enrollments WHERE class_id={:classId} AND id!={:id}",
        )
        .bind({ classId: classroom.id, id: r.id })
        .one(count);
      if (count.total >= classroom.getInt("capacity"))
        throw new BadRequestError(
          "Cette classe a atteint sa capacité maximale.",
        );
      if (
        r.getFloat("registration_fee") + r.getFloat("tuition_fee") <
        paid(tx, r.id)
      )
        throw new BadRequestError(
          "Les frais ne peuvent pas être inférieurs aux versements déjà enregistrés.",
        );
      const planned = new DynamicModel({ total: 0 });
      tx.db()
        .newQuery(
          "SELECT COALESCE(SUM(amount),0) total FROM payment_deadlines WHERE enrollment={:id}",
        )
        .bind({ id: r.id })
        .one(planned);
      if (
        planned.total >
        r.getFloat("registration_fee") + r.getFloat("tuition_fee")
      )
        throw new BadRequestError(
          "Réduisez d’abord l’échéancier : il dépasse les nouveaux frais.",
        );
      e.next();
    });
  },
  payment(e) {
    e.app.runInTransaction((tx) => {
      e.app = tx;
      const r = e.record,
        inscription = tx.findRecordById(
          "enrollments",
          r.getString("enrollment_id"),
        );
      if (
        inscription.getString("establishment_id") !==
        r.getString("establishment_id")
      )
        throw new BadRequestError("Inscription d’un autre établissement.");
      const recorder = tx.findRecordById(
        "school_users",
        r.getString("recorded_by"),
      );
      if (
        recorder.getString("establishment_id") !==
          r.getString("establishment_id") ||
        !["administrator", "accountant"].includes(recorder.getString("role"))
      )
        throw new BadRequestError("Agent d’encaissement invalide.");
      const amount = r.getFloat("amount");
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new BadRequestError(
          "Le montant doit être un entier supérieur à zéro.",
        );
      date(r.getString("paid_on"));
      if (
        paid(tx, inscription.id) + amount >
        inscription.getFloat("registration_fee") +
          inscription.getFloat("tuition_fee")
      )
        throw new BadRequestError("Le versement dépasse le reste à payer.");
      e.next();
    });
  },
};
