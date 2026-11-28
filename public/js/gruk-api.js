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

  async function cargarContextoEmpresaGRUK() {
    const token = localStorage.getItem("grukAuthToken");
    if (!token) throw new Error("Sesión requerida");
    const response = await grukFetch("/api/onboarding/me", {cache:"no-store"});
    if (!response.ok) throw new Error("Identidad empresarial no autorizada");
    const profile = await response.json();
    if (!profile.ok || !/^[a-f0-9]{24}$/i.test(profile.empresaId) || !/^[a-f0-9]{24}$/i.test(profile.sedeId) || token !== localStorage.getItem("grukAuthToken")) throw new Error("Contexto empresarial inválido");
    return Object.freeze({empresaId:profile.empresaId,sedeId:profile.sedeId,restaurantId:profile.tipoNegocio==="restaurante"&&profile.modulos?.restaurante===true?profile.restaurantId||null:null,tipoNegocio:profile.tipoNegocio,empresaNombre:profile.empresaNombre,usuario:profile.usuario,rol:profile.rol,modulos:Object.freeze({...profile.modulos})});
  }

  window.cargarContextoEmpresaGRUK = cargarContextoEmpresaGRUK;
  window.grukFetch = grukFetch;
})();
