migrate(
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    const own =
      '@request.auth.id != "" && @request.auth.collectionName = "school_users" && @request.auth.disabled = false && establishment_id = @request.auth.establishment_id';
    const finance =
      "(" +
      own +
      ") && (@request.auth.role = 'administrator' || @request.auth.role = 'accountant')";
    payments.listRule = finance;
    payments.viewRule = finance;
    payments.createRule = finance;
    payments.updateRule = null;
    payments.deleteRule = null;
    app.save(payments);
  },
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    const own =
      '@request.auth.id != "" && @request.auth.collectionName = "school_users" && @request.auth.role = "administrator" && @request.auth.disabled = false && establishment_id = @request.auth.establishment_id';
    payments.listRule = own;
    payments.viewRule = own;
    payments.createRule = own;
    payments.updateRule = null;
    payments.deleteRule = null;
    app.save(payments);
  },
);
