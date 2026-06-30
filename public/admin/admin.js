function toggleMenuGRUK() {
  const menu = document.getElementById("menuAdminGRUK");
  if (menu) menu.classList.toggle("abierto");
}

async function cargarModuloGRUK(modulo) {
  const contenedor = document.getElementById("contenedorModuloGRUK");

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="card">
      <p>Cargando módulo ${modulo}...</p>
    </div>
  `;

  const res = await fetch(`/admin-modulos/${modulo}.html`);
  const html = await res.text();

  contenedor.innerHTML = html;

  const menu = document.getElementById("menuAdminGRUK");
  if (menu) menu.classList.remove("abierto");

  if (modulo === "laboral") {
    const linkLaboral = document.getElementById("linkModuloLaboralGRUK");

    if (linkLaboral) {
      linkLaboral.href = `/laboral.html?restaurantId=${adminRestaurantId}`;
    }

    if (typeof cargarPanelesAdminLaboralGRUK === "function") {
      cargarPanelesAdminLaboralGRUK();
    }
  }

  if (typeof cargarAdmin === "function") {
    cargarAdmin();
  }
}