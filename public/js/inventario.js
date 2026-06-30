async function guardarInventario() {
  try {
    const restaurantId =
      localStorage.getItem("adminRestaurantId") ||
      getRestaurantId();

    const body = {
      restaurantId,
      nombre: document.getElementById("inventarioNombre").value,
      categoria: document.getElementById("inventarioCategoria").value,
      cantidad: Number(document.getElementById("inventarioCantidad").value),
      costo: Number(document.getElementById("inventarioCosto").value || 0),
      unidad: document.getElementById("inventarioUnidad").value,
      proveedor: document.getElementById("inventarioProveedor").value,
      fechaCompra: document.getElementById("inventarioCompra").value,
      fechaVencimiento: document.getElementById("inventarioVencimiento").value
    };

    const res = await fetch("/api/inventario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.ok) {
      alert("Error guardando");
      return;
    }

    alert("Inventario guardado");
    cargarInventario();

  } catch (error) {
    console.log(error);
  }
}

async function cargarInventario() {
  try {
    const restaurantId =
      localStorage.getItem("adminRestaurantId") ||
      getRestaurantId();

    const res = await fetch(`/api/inventario/${restaurantId}`);
    const data = await res.json();

    if (!data.ok) return;

    const contenedor = document.getElementById("inventarioLista");
    const resumen = document.getElementById("inventarioResumen");

    if (!contenedor) return;

    contenedor.innerHTML = "";

    const productos = data.productos || [];

    const productosOrdenados = productos.sort((a, b) => {
      return a.diasRestantes - b.diasRestantes;
    });

    if (resumen) {
      const totalProductos = productos.length;

      const proximos = productos.filter(
        p => p.estado === "proximo"
      ).length;

      const vencidos = productos.filter(
        p => p.estado === "vencido"
      ).length;

      const valorInventario = productos.reduce((acc, p) => {
        return acc + (
          Number(p.cantidad || 0) *
          Number(p.costo || 0)
        );
      }, 0);

      resumen.innerHTML = `
        <div class="card">
          <h3>📦 Resumen de inventario</h3>

          <p>Productos registrados: <strong>${totalProductos}</strong></p>
          <p>Próximos a vencer: <strong>${proximos}</strong></p>
          <p>Vencidos: <strong>${vencidos}</strong></p>

          <p>
            💰 Valor total inventario:
            <strong>${formatoCOP(valorInventario)}</strong>
          </p>
        </div>
      `;
    }

    contenedor.innerHTML = `
      <table style="
        width:100%;
        border-collapse:collapse;
        background:rgba(15,23,42,85);
        color:white;
        border-radius:12px;
        overflow:hidden;
      ">
        <thead>
          <tr style="background:#0f172a;color:white;">
            <th style="padding:12px;">Producto</th>
            <th style="padding:12px;">Categoría</th>
            <th style="padding:12px;">Cantidad</th>
            <th style="padding:12px;">Unidad</th>
            <th style="padding:12px;">Costo</th>
            <th style="padding:12px;">Total</th>
            <th style="padding:12px;">Proveedor</th>
            <th style="padding:12px;">Vence</th>
            <th style="padding:12px;">Estado</th>
            <th style="padding:12px;">Días</th>
            <th style="padding:12px;">Acción</th>
          </tr>
        </thead>

        <tbody>
          ${productosOrdenados.map(producto => {
            const costoUnitario = Number(
              producto.costo ||
              producto.precioCompra ||
              0
            );

            const valorTotalProducto =
              Number(producto.cantidad || 0) * costoUnitario;

            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,15);">
                <td>${producto.nombre}</td>
                <td>${producto.categoria}</td>
                <td>${producto.cantidad}</td>
                <td>${producto.unidad}</td>
                <td>${formatoCOP(costoUnitario)}</td>
                <td>${formatoCOP(valorTotalProducto)}</td>
                <td>${producto.proveedor || "-"}</td>
                <td>
                  ${
                    producto.fechaVencimiento
                      ? producto.fechaVencimiento.split("T")[0]
                      : "-"
                  }
                </td>
                <td>
                  ${
                    producto.estado === "vigente"
                      ? "✅ Vigente"
                      : producto.estado === "proximo"
                        ? "⚠️ Próximo"
                        : "❌ Vencido"
                  }
                </td>
                <td>${producto.diasRestantes}</td>
                <td>
                  <button onclick="anularInventario('${producto._id}')">
                    Anular
                  </button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

  } catch (error) {
    console.log(error);
  }
}

function mostrarCarpetaInventario() {
  const carpeta = document.getElementById("carpetaInventario");

  if (!carpeta) return;

  carpeta.style.display =
    carpeta.style.display === "none"
      ? "block"
      : "none";
}

async function anularInventario(id) {
  const motivo = prompt("Escribe el motivo de anulación:");

  if (!motivo) {
    alert("Debes escribir un motivo");
    return;
  }

  const usuario =
    localStorage.getItem("adminUsuario") || "admin";

  const res = await fetch(`/api/inventario/anular/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      motivo,
      usuario
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "No se pudo anular");
    return;
  }

  alert("Producto anulado con trazabilidad");
  cargarInventario();
}

async function inicializarInventarioGRUK() {
  await cargarInventario();
}