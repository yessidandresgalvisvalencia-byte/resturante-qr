let productoEnEdicion = null;
let productosStockActuales = [];

function actualizarLinksRestaurant() {
  const restaurantId = getRestaurantId();
  const baseUrl = window.location.origin;

  const restaurantIdActual = document.getElementById("restaurantIdActual");
  if (restaurantIdActual) restaurantIdActual.textContent = restaurantId;

  const links = {
    linkMenu: `${baseUrl}/?restaurantId=${restaurantId}&mesa=1`,
    linkCocina: `${baseUrl}/cocina.html?restaurantId=${restaurantId}`,
    linkCaja: `${baseUrl}/caja.html?restaurantId=${restaurantId}`,
    linkMesero: `${baseUrl}/mesero.html?restaurantId=${restaurantId}`,
    linkAdmin: `${baseUrl}/admin.html?restaurantId=${restaurantId}`,
    linkDashboard: `${baseUrl}/admin-dashboard.html?restaurant=${restaurantId}&modo=manual`,
    linkDashboardAuto: `${baseUrl}/admin-dashboard.html?restaurant=${restaurantId}`
  };

  Object.entries(links).forEach(([id, url]) => {
    const el = document.getElementById(id);
    if (el) {
      el.href = url;
      el.textContent = url;
    }
  });

  const linkLogo = document.getElementById("linkLogoRestaurante");
  if (linkLogo) {
    linkLogo.href = `/admin-restaurante.html?restaurantId=${restaurantId}`;
    linkLogo.style.display = "inline-block";
  }
}

function generarQRs() {
  const restaurantId = getRestaurantId();
  const baseUrlInput = document.getElementById("baseUrl");
  const numeroMesasInput = document.getElementById("numeroMesas");
  const qrs = document.getElementById("qrs");

  if (!qrs) return;

  const baseUrl = (baseUrlInput?.value || window.location.origin).trim();
  const numeroMesas = Number(numeroMesasInput?.value || 10);

  qrs.innerHTML = "";

  for (let mesa = 1; mesa <= numeroMesas; mesa++) {
    const url = `${baseUrl}/?restaurantId=${restaurantId}&mesa=${mesa}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

    qrs.innerHTML += `
      <div class="card">
        <h3>Mesa ${mesa}</h3>
        <img src="${qrUrl}" alt="QR Mesa ${mesa}" style="width:180px;height:180px;">
        <p style="word-break: break-all;">${url}</p>
        <a href="${url}" target="_blank">Abrir menú</a>
      </div>
    `;
  }
}

function parsearGuarniciones(texto) {
  if (!texto || !texto.trim()) return [];
  return texto.split(",").map(g => g.trim()).filter(Boolean);
}

function parsearExtras(texto) {
  if (!texto || !texto.trim()) return [];

  return texto
    .split(",")
    .map(parte => {
      const [nombre, precio] = parte.split(":");
      return {
        nombre: (nombre || "").trim(),
        precio: Number((precio || "0").trim())
      };
    })
    .filter(extra => extra.nombre);
}

function extrasATexto(extras) {
  if (!Array.isArray(extras) || !extras.length) return "";
  return extras.map(extra => `${extra.nombre}:${extra.precio}`).join(", ");
}

function guarnicionesATexto(guarniciones) {
  if (!Array.isArray(guarniciones) || !guarniciones.length) return "";
  return guarniciones.join(", ");
}

async function cargarStock(restaurantId) {
  try {
    const res = await fetch(`/api/menu?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    productosStockActuales = data;

    const stockLista = document.getElementById("stockLista");
    if (!stockLista) return;

    stockLista.innerHTML = "";

    if (!data.length) {
      stockLista.innerHTML = `
        <div class="card">
          <p>No hay productos todavía.</p>
        </div>
      `;
      return;
    }

    data.forEach(item => {
      const descripcion = item.descripcion || "Sin descripción";

      const guarniciones = Array.isArray(item.guarniciones) && item.guarniciones.length
        ? item.guarniciones.join(", ")
        : "Sin guarniciones";

      const extras = Array.isArray(item.extras) && item.extras.length
        ? item.extras.map(extra => `${extra.nombre} (+$${extra.precio})`).join(", ")
        : "Sin extras";

      stockLista.innerHTML += `
        <div class="card">
          <h3>${item.nombre}</h3>
          <p><strong>Categoría:</strong> ${item.categoria}</p>
          <p><strong>Descripción:</strong> ${descripcion}</p>
          <p><strong>Precio:</strong> $${item.precio}</p>
          <p><strong>Guarniciones:</strong> ${guarniciones}</p>
          <p><strong>Extras:</strong> ${extras}</p>
          <p><strong>Disponible:</strong> ${item.disponible ? "Sí" : "No"}</p>

          <button onclick="editarProductoPorId(${item.id})">Editar</button>

          <button onclick="cambiarStock(${item.id}, ${!item.disponible})">
            ${item.disponible ? "Marcar como agotado" : "Marcar como disponible"}
          </button>

          <button onclick="eliminarProducto(${item.id})">Eliminar</button>
        </div>
      `;
    });

  } catch (error) {
    console.log("Stock no disponible:", error);
  }
}

function editarProductoPorId(id) {
  const item = productosStockActuales.find(producto => Number(producto.id) === Number(id));

  if (!item) {
    alert("No se encontró el producto para editar");
    return;
  }

  editarProducto(item);
}

function editarProducto(item) {
  productoEnEdicion = item.id;

  document.getElementById("nombreProducto").value = item.nombre || "";
  document.getElementById("descripcionProducto").value = item.descripcion || "";
  document.getElementById("precioProducto").value = item.precio || "";
  document.getElementById("costoMateriaProducto").value = item.costoMateriaPrima || "";
  document.getElementById("categoriaProducto").value = item.categoria || "Comida";
  document.getElementById("guarnicionesProducto").value = guarnicionesATexto(item.guarniciones);
  document.getElementById("extrasProducto").value = extrasATexto(item.extras);
  document.getElementById("imagenProducto").value = item.imagen || "";
  document.getElementById("tiempoProducto").value = item.tiempoBase || 10;
  document.getElementById("disponibleProducto").value = item.disponible ? "true" : "false";

  document.getElementById("btnGuardarProducto").textContent = "Actualizar producto";
  document.getElementById("btnCancelarEdicion").style.display = "inline-block";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function limpiarFormularioProducto() {
  document.getElementById("nombreProducto").value = "";
  document.getElementById("descripcionProducto").value = "";
  document.getElementById("precioProducto").value = "";
  document.getElementById("costoMateriaProducto").value = "";
  document.getElementById("categoriaProducto").value = "Comida";
  document.getElementById("guarnicionesProducto").value = "";
  document.getElementById("extrasProducto").value = "";
  document.getElementById("imagenProducto").value = "";
  document.getElementById("tiempoProducto").value = 10;
  document.getElementById("disponibleProducto").value = "true";
}

function cancelarEdicion() {
  productoEnEdicion = null;
  limpiarFormularioProducto();

  document.getElementById("btnGuardarProducto").textContent = "Guardar producto";
  document.getElementById("btnCancelarEdicion").style.display = "none";
}

async function guardarOEditarProducto() {
  try {
    const restaurantId = getRestaurantId();

    const nombre = document.getElementById("nombreProducto").value.trim();
    const descripcion = document.getElementById("descripcionProducto").value.trim();
    const precio = Number(document.getElementById("precioProducto").value || 0);
    const costoMateriaPrima = Number(document.getElementById("costoMateriaProducto").value || 0);
    const categoria = document.getElementById("categoriaProducto").value;
    const guarniciones = parsearGuarniciones(document.getElementById("guarnicionesProducto").value);
    const extras = parsearExtras(document.getElementById("extrasProducto").value);
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

    const payload = {
      restaurantId,
      nombre,
      descripcion,
      precio,
      costoMateriaPrima,
      categoria,
      guarniciones,
      extras,
      imagen,
      tiempoBase,
      disponible
    };

    let res;

    if (productoEnEdicion) {
      res = await grukFetch(`/api/menu/${productoEnEdicion}?restaurantId=${restaurantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } else {
      res = await grukFetch("/api/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No se pudo guardar el producto");
      return;
    }

    alert(productoEnEdicion ? "Producto actualizado correctamente" : "Producto agregado correctamente");

    cancelarEdicion();
    await cargarStock(restaurantId);

  } catch (error) {
    console.log("ERROR GUARDANDO PRODUCTO", error);
    alert("Error guardando producto");
  }
}

async function cambiarStock(id, disponible) {
  try {
    const restaurantId = getRestaurantId();

    const res = await grukFetch(`/api/menu/${id}/stock?restaurantId=${restaurantId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ disponible })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "No se pudo actualizar el stock");
      return;
    }

    await cargarStock(restaurantId);

  } catch (error) {
    console.log("Error actualizando stock:", error);
    alert("Error actualizando stock");
  }
}

async function eliminarProducto(id) {
  try {
    const restaurantId = getRestaurantId();
    const confirmar = confirm("¿Seguro que quieres eliminar este producto?");
    if (!confirmar) return;

    const res = await grukFetch(`/api/menu/${id}?restaurantId=${restaurantId}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No se pudo eliminar el producto");
      return;
    }

    alert("Producto eliminado correctamente");
    await cargarStock(restaurantId);

  } catch (error) {
    console.log("ERROR ELIMINANDO PRODUCTO", error);
    alert("Error eliminando producto");
  }
}

async function cargarLogoRestaurante() {
  const paramsLogo = new URLSearchParams(window.location.search);
  const restaurantIdLogo =
    paramsLogo.get("restaurantId") ||
    localStorage.getItem("adminRestaurantId");

  if (!restaurantIdLogo) return;

  try {
    const res = await fetch(`/api/restaurants/${restaurantIdLogo}`);
    const data = await res.json();

    if (data.ok && data.restaurante.logoUrl) {
      const logo = document.getElementById("logoRestaurante");

      if (logo) {
        logo.src = data.restaurante.logoUrl;
      }

      document.body.style.setProperty(
        "--fondo-restaurante",
        `url(${data.restaurante.logoUrl})`
      );
    }
  } catch (error) {
    console.log("Error cargando logo restaurante:", error);
  }
}

async function inicializarRestauranteGRUK() {
  const restaurantId = getRestaurantId();

  const baseUrlInput = document.getElementById("baseUrl");
  if (baseUrlInput) {
    baseUrlInput.value = window.location.origin;
  }

  const restaurantIdInput = document.getElementById("restaurantIdInput");
  if (restaurantIdInput) {
    restaurantIdInput.value = restaurantId;
  }

  actualizarLinksRestaurant();
  await cargarStock(restaurantId);
  await cargarLogoRestaurante();
}