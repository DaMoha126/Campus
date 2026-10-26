routerAdd("GET", "/api/etudia/config", (e) =>
  e.json(200, { demo: $os.getenv("ETUDIA_DEMO") === "1" }),
);
$app.rootCmd.addCommand(new Command({
  use: "seed-demo",
  run: () => {
    if ($os.getenv("ETUDIA_DEMO") !== "1") throw new Error("Demo mode is disabled.");
    if (!$app.isBootstrapped()) $app.bootstrap();
    require(__hooks + "/demo-seed.cjs").seed($app, $os.getenv("ETUDIA_DEMO_PASSWORD"));
  },
}));
