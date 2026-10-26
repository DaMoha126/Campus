fetch("/api/etudia/config")
  .then((response) => response.ok ? response.json() : null)
  .then((config) => {
    if (config?.demo === true) document.getElementById("demo-banner").hidden = false;
  })
  .catch(() => {});
