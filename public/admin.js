const socket = io();

function getRestaurantId() {
  return document.getElementById("restaurantIdInput").value.trim() || "rest1";
}

function actualizarLinksRestaurant() {
  const restaurantId = getRestaurantId();
  const baseUrl = window.location.origin;

  const restaurantIdActual = document.getElementById("restaurantIdActual");
  const linkMenu = document.getElementById("linkMenu");
  const linkCocina = document.getElementById("linkCocina");
  const linkMesero = document.getElementById("linkMesero");
  const linkAdmin = document.getElementById("linkAdmin");

  if (restaurantIdActual) {
    restaurantIdActual.textContent = restaurantId;
  }

  const menuUrl = `${baseUrl}/?restaurantId=${restaurantId}&mesa=1`;
  const cocinaUrl = `${baseUrl}/cocina.html?restaurantId=${restaurantId}`;
  const meseroUrl = `${baseUrl}/mesero.html?restaurantId=${restaurantId}`;
  const adminUrl = `${baseUrl}/admin.html?restaurantId=${restaurantId}`;

  if (linkMenu) {
    linkMenu.href = menuUrl;
    linkMenu.textContent = menuUrl;
  }

  if (linkCocina) {
    linkCocina.href = cocinaUrl;
    linkCocina.textContent = cocinaUrl;
  }

  if (linkMesero) {
    linkMesero.href = meseroUrl;
    linkMesero.textContent = meseroUrl;
  }

  if (linkAdmin) {
    linkAdmin.href = adminUrl;
    linkAdmin.textContent = adminUrl;
  }
}

function generarQRs() {
  const restaurantId = getRestaurantId();
  const baseUrlInput = document.getElementById("baseUrl");
  const numeroMesasInput = document.getElementById("numeroMesas");
  const qrs = document.getElementById("qrs");

  const baseUrl = (baseUrlInput?.value || window.location.origin).trim();
  const numeroMesas = Number(numeroMesasInput?.value || 10);

  if (!qrs) return;

  qrs.innerHTML = "";

  for (let mesa = 1; mesa <= numeroMesas; mesa++) {
    const url = `${baseUrl}/?restaurantId=${restaurantId}&mesa=${mesa}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

    qrs.innerHTML += `
      <div class="card">
        <h3>Mesa ${mesa}</h3>
        <img src="${qrUrl}" alt="QR Mesa ${mesa}" style="width: 180px; height: 180px;">
        <p style="word-break: break-all;">${url}</p>
        <a href="${url}" target="_blank">Abrir menú</a>
      </div>
    `;
  }
}

async function cargarResumen(restaurantId) {
  try {
    const res = await fetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();

    const totalVendido = document.getElementById("totalVendido");
    const pedidosActivos = document.getElementById("pedidosActivos");

    if (totalVendido) {
      totalVendido.textContent = `$${data.totalVendido || 0}`;
    }

    if (pedidosActivos) {
      pedidosActivos.textContent = data.pedidosActivos || 0;
    }
  } catch (error) {
    console.log("Resumen admin no disponible:", error);
  }
}

async function cargarTopProductos(restaurantId) {
  try {
    const res = await fetch(`/api/admin/top-productos?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const topProductos = document.getElementById("topProductos");
    if (!topProductos) return;

    topProductos.innerHTML = "";

    if (!data.length) {
      topProductos.innerHTML = `<div class="card"><p>No hay datos todavía.</p></div>`;
      return;
    }

    data.forEach(item => {
      topProductos.innerHTML += `
        <div class="card">
          <h3>${item.producto}</h3>
          <p>Vendidos: ${item.cantidad}</p>
        </div>
      `;
    });
  } catch (error) {
    console.log("Top productos no disponible:", error);
  }
}

async function cargarHistorialVentas(restaurantId) {
  try {
    const res = await fetch(`/api/admin/historial-ventas?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const historialVentas = document.getElementById("historialVentas");
    if (!historialVentas) return;

    historialVentas.innerHTML = "";

    if (!data.length) {
      historialVentas.innerHTML = `<div class="card"><p>No hay ventas todavía.</p></div>`;
      return;
    }

    data.forEach(item => {
      historialVentas.innerHTML += `
        <div class="card">
          <h3>${item.producto || "Venta"}</h3>
          <p>Mesa: ${item.mesa || "-"}</p>
          <p>Valor: $${item.precio || 0}</p>
          <p>Estado pago: ${item.estadoPago || "-"}</p>
        </div>
      `;
    });
  } catch (error) {
    console.log("Historial ventas no disponible:", error);
  }
}

async function cargarStock(restaurantId) {
  try {
    const res = await fetch(`/api/menu?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const stockLista = document.getElementById("stockLista");
    if (!stockLista) return;

    stockLista.innerHTML = "";

    if (!data.length) {
      stockLista.innerHTML = `<div class="card"><p>No hay productos todavía.</p></div>`;
      return;
    }

    data.forEach(item => {
      stockLista.innerHTML += `
        <div class="card">
          <h3>${item.nombre}</h3>
          <p>Categoría: ${item.categoria}</p>
          <p>Precio: $${item.precio}</p>
          <p>Disponible: ${item.disponible ? "Sí" : "No"}</p>
        </div>
      `;
    });
  } catch (error) {
    console.log("Stock no disponible:", error);
  }
}

async function agregarProducto() {
  try {
    const restaurantId = getRestaurantId();

    const nombre = document.getElementById("nombreProducto").value.trim();
    const precio = Number(document.getElementById("precioProducto").value || 0);
    const categoria = document.getElementById("categoriaProducto").value;
    const imagen = document.getElementById("imagenProducto").value.trim();
    const tiempoBase = Number(document.getElementById("tiempoProducto").value || 10);
    const disponible = document.getElementById("disponibleProducto").value === "true";

    if (!nombre) {
      alert("Escribe el nombre del producto");
      return;
    }

    if (precio <= 0) {
      alert("El precio debe ser mayor a 0");
      return;
    }

    console.log("DATOS A ENVIAR", {
      restaurantId,
      nombre,
      precio,
      categoria,
      imagen,
      tiempoBase,
      disponible
    });

    const res = await fetch("/api/menu", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        restaurantId,
        nombre,
        precio,
        categoria,
        imagen,
        tiempoBase,
        disponible
      })
    });

    console.log("STATUS RESPUESTA", res.status);

    const data = await res.json();
    console.log("RESPUESTA BACKEND", data);

    if (!res.ok) {
      alert(data.error || "No se pudo guardar el producto");
      return;
    }

    alert("Producto agregado correctamente");

    document.getElementById("nombreProducto").value = "";
    document.getElementById("precioProducto").value = "";
    document.getElementById("categoriaProducto").value = "Comida";
    document.getElementById("imagenProducto").value = "";
    document.getElementById("tiempoProducto").value = 10;
    document.getElementById("disponibleProducto").value = "true";

    cargarAdmin();
  } catch (error) {
    console.log("ERROR AGREGANDO PRODUCTO", error);
    alert("Error agregando producto");
  }
}

async function cargarAdmin() {
  const restaurantId = getRestaurantId();

  actualizarLinksRestaurant();

  await cargarResumen(restaurantId);
  await cargarTopProductos(restaurantId);
  await cargarHistorialVentas(restaurantId);
  await cargarStock(restaurantId);
}

document.getElementById("baseUrl").value = window.location.origin;

const params = new URLSearchParams(window.location.search);
const restaurantIdUrl = params.get("restaurantId") || "rest1";

document.getElementById("restaurantIdInput").value = restaurantIdUrl;

socket.on("pedido:nuevo", (pedido) => {
  if (pedido.restaurantId === getRestaurantId()) {
    cargarAdmin();
  }
});

socket.on("pedido:actualizado", (pedido) => {
  if (pedido.restaurantId === getRestaurantId()) {
    cargarAdmin();
  }
});

socket.on("menu:actualizado", (payload) => {
  if (payload.restaurantId === getRestaurantId()) {
    cargarAdmin();
  }
});

actualizarLinksRestaurant();
cargarAdmin();