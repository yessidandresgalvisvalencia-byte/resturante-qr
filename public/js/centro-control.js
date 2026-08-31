async function inicializarCentroControlGRUK() {
  const restaurantId = getRestaurantId();

  await cargarResumen(restaurantId);
  await cargarTopProductos(restaurantId);
  await cargarHistorialVentas(restaurantId);
  await cargarSolicitudesMesero(restaurantId);

  cargarEstrategiasAplicadas();
  cargarProductosRecomendadosAdmin();
}

async function cargarResumen(restaurantId) {
  try {
    const res = await grukFetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();

    const totalVendido = document.getElementById("totalVendido");
    const pedidosActivos = document.getElementById("pedidosActivos");

    if (totalVendido) totalVendido.textContent = `$${data.totalVendido || 0}`;
    if (pedidosActivos) pedidosActivos.textContent = data.pedidosActivos || 0;

  } catch (error) {
    console.log("Resumen admin no disponible:", error);
  }
}

async function cargarTopProductos(restaurantId) {
  try {
    const res = await grukFetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const topProductos = document.getElementById("topProductos");
    if (!topProductos) return;

    const productos = data.topProductos || [];

    topProductos.innerHTML = productos.length
      ? productos.map(item => `
        <div class="card">
          <h3>${item.producto}</h3>
          <p>Vendidos: ${item.cantidad}</p>
        </div>
      `).join("")
      : `<div class="card"><p>No hay datos todavía.</p></div>`;

  } catch (error) {
    console.log("Top productos no disponible:", error);
  }
}

async function cargarHistorialVentas(restaurantId) {
  try {
    const res = await grukFetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const historialVentas = document.getElementById("historialVentas");
    if (!historialVentas) return;

    const historial = data.historial || [];

    historialVentas.innerHTML = historial.length
      ? historial.map(item => `
        <div class="card">
          <h3>${item.producto || "Venta"}</h3>
          <p>Mesa: ${item.mesa || "-"}</p>
          <p>Valor: $${item.precio || 0}</p>
          <p>Estado pago: ${item.estadoPago || "-"}</p>
        </div>
      `).join("")
      : `<div class="card"><p>No hay ventas todavía.</p></div>`;

  } catch (error) {
    console.log("Historial ventas no disponible:", error);
  }
}

async function cargarSolicitudesMesero(restaurantId) {
  try {
    const res = await fetch(`/api/llamados?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const solicitudesMesero = document.getElementById("solicitudesMesero");
    if (!solicitudesMesero) return;

    const pendientes = data.filter(item => item.estado !== "atendido");

    solicitudesMesero.innerHTML = pendientes.length
      ? pendientes.map(item => `
        <div class="card">
          <h3>Mesa ${item.mesa} necesita al mesero ${item.meseroNombre || "sin asignar"}</h3>
          <p>${tiempoTranscurrido(item.createdAt)}</p>
          <p>Estado: ${item.estado === "atendiendo" ? "🟡 Atendiendo..." : "🔴 Pendiente"}</p>
        </div>
      `).join("")
      : `<div class="card"><p>No hay solicitudes de mesero.</p></div>`;

  } catch (error) {
    console.log("Solicitudes de mesero no disponibles:", error);
  }
}

function cargarEstrategiasAplicadas() {
  const contenedor = document.getElementById("estrategiasAplicadas");
  if (!contenedor) return;

  const restaurantId = getRestaurantId();

  const estrategias =
    JSON.parse(localStorage.getItem(`estrategias_${restaurantId}`)) || [];

  if (!estrategias.length) {
    contenedor.innerHTML = `<div class="card">No hay estrategias aplicadas.</div>`;
    return;
  }

  contenedor.innerHTML = estrategias.map(e => `
    <div class="card">
      <h3>Estrategia ${e.numero}</h3>
      <p><strong>${e.titulo}</strong></p>
      <ul>
        ${(e.productos || []).map(p => `<li>${p}</li>`).join("")}
      </ul>
    </div>
  `).join("");
}

function cargarProductosRecomendadosAdmin() {
  const contenedor = document.getElementById("productosRecomendadosAdmin");
  if (!contenedor) return;

  const restaurantId = getRestaurantId();

  const productos =
    JSON.parse(localStorage.getItem(`productos_recomendados_${restaurantId}`)) || [];

  contenedor.innerHTML = productos.length
    ? productos.map(producto => `
      <div class="card">
        <h3>${producto}</h3>
        <p>Producto recomendado en el menú.</p>
      </div>
    `).join("")
    : `<div class="card">No hay productos recomendados todavía.</div>`;
}