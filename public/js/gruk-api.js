(function () {
  "use strict";

  async function grukFetch(url, options = {}) {
    const token = localStorage.getItem("grukAuthToken");
    const headers = new Headers(options.headers || {});

    const destino = new URL(url, window.location.origin);
    const esMismoOrigen = destino.origin === window.location.origin;

    if (token && esMismoOrigen && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  window.grukFetch = grukFetch;
})();
