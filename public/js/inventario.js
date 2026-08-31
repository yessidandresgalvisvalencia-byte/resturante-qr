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

    const res = await grukFetch("/api/inventario", {
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

    const res = await grukFetch(`/api/inventario/${restaurantId}`);
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

  const res = await grukFetch(`/api/inventario/anular/${id}`, {
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
async function generarPlanInventarioMensualGRUK() {
  const restaurantId =
    localStorage.getItem("adminRestaurantId") ||
    getRestaurantId();

  const res = await grukFetch(`/api/inventario/${restaurantId}`);
  const data = await res.json();

  if (!data.ok) {
    alert("No se pudo analizar el inventario.");
    return;
  }

  const productos = data.productos || [];

  const hoy = new Date();

  const mesProximo = new Date(
    hoy.getFullYear(),
    hoy.getMonth() + 1,
    1
  );

  const mesNombre = mesProximo.toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric"
  });

  const eventos = detectarEventosInventarioGRUK(mesProximo);

  const analisis = productos.map(p => {
    const cantidad = Number(p.cantidad || 0);
    const dias = Number(p.diasRestantes || 0);

    let recomendacion = "Mantener compra normal";
    let prioridad = "🟢 Normal";
    let accion = "Revisar rotación antes de comprar más.";

    if (p.estado === "vencido") {
      prioridad = "🔴 Crítico";
      recomendacion = "No comprar más";
      accion = "Retirar o revisar inmediatamente. No debe usarse sin validación.";
    } else if (p.estado === "proximo" || dias <= 7) {
      prioridad = "🟠 Alta";
      recomendacion = "Usar primero";
      accion = "Priorizar este producto en ventas, combos o producción antes de comprar más.";
    } else if (dias <= 20) {
      prioridad = "🟡 Media";
      recomendacion = "Comprar con cuidado";
      accion = "Evitar sobrecompra. Consumir inventario actual antes de reponer.";
    }

    if (eventos.factorDemanda > 1 && p.categoria) {
      const categoria = String(p.categoria).toLowerCase();

      if (
        categoria.includes("bebida") ||
        categoria.includes("carne") ||
        categoria.includes("comida") ||
        categoria.includes("insumo")
      ) {
        recomendacion = "Aumentar compra controlada";
        accion += ` Evento próximo detectado: ${eventos.descripcion}. Aumentar compra entre 10% y 25% si el producto rota bien.`;
      }
    }

    if (cantidad <= 0) {
      prioridad = "🔴 Crítico";
      recomendacion = "Reponer";
      accion = "Producto sin existencia. Reponer si es necesario para operación.";
    }

    return {
      nombre: p.nombre,
      categoria: p.categoria,
      cantidad,
      unidad: p.unidad,
      diasRestantes: dias,
      estado: p.estado,
      prioridad,
      recomendacion,
      accion
    };
  });

  const contenedor = document.getElementById("planInventarioMensual");

  if (!contenedor) {
    alert("Falta el contenedor planInventarioMensual en inventario.html");
    return;
  }

  contenedor.innerHTML = `
    <div class="card">
      <h3>🧠 Planificador mensual de inventario GRUK</h3>
      <p><strong>Mes analizado:</strong> ${mesNombre}</p>
      <p><strong>Contexto detectado:</strong> ${eventos.descripcion}</p>
      <p><strong>Factor de demanda:</strong> ${eventos.factorDemanda}x</p>

      <table style="width:100%;border-collapse:collapse;margin-top:15px;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Cantidad</th>
            <th>Vence en</th>
            <th>Prioridad</th>
            <th>Recomendación</th>
            <th>Acción GRUK</th>
          </tr>
        </thead>

        <tbody>
          ${analisis.map(item => `
            <tr>
              <td>${item.nombre}</td>
              <td>${item.categoria || "-"}</td>
              <td>${item.cantidad} ${item.unidad || ""}</td>
              <td>${item.diasRestantes} días</td>
              <td>${item.prioridad}</td>
              <td>${item.recomendacion}</td>
              <td>${item.accion}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function detectarEventosInventarioGRUK(fechaMes) {
  const mes = fechaMes.getMonth() + 1;

  let descripcion = "Mes normal sin eventos fuertes detectados.";
  let factorDemanda = 1;

  if (mes === 12) {
    descripcion = "Temporada navideña y fin de año. Puede aumentar demanda de comidas, bebidas y celebraciones.";
    factorDemanda = 1.25;
  }

  if (mes === 1) {
    descripcion = "Enero puede tener demanda irregular por vacaciones y menor flujo en algunos sectores.";
    factorDemanda = 0.9;
  }

  if (mes === 5) {
    descripcion = "Mes con celebraciones familiares como Día de la Madre. Puede subir demanda de comidas especiales y bebidas.";
    factorDemanda = 1.15;
  }

  if (mes === 6 || mes === 7) {
    descripcion = "Temporada de vacaciones y posibles eventos deportivos. Vigilar demanda de comidas rápidas, carnes y bebidas.";
    factorDemanda = 1.12;
  }

  if (mes === 9 || mes === 10) {
    descripcion = "Mes comercial relativamente normal. Mantener compras controladas según rotación.";
    factorDemanda = 1;
  }

  return {
    descripcion,
    factorDemanda
  };
}
async function diagnosticoInventarioGRUK() {
  const restaurantId =
    localStorage.getItem("adminRestaurantId") ||
    getRestaurantId();

  const res = await grukFetch(`/api/inventario/${restaurantId}`);
  const data = await res.json();

  if (!data.ok) {
    alert("No se pudo cargar el inventario.");
    return;
  }

  const productos = data.productos || [];
  const contenedor = document.getElementById("resultadoDiagnosticoGRUK") || document.getElementById("planInventarioMensual");

  if (!contenedor) {
    alert("Falta el contenedor de diagnóstico.");
    return;
  }

  const totalProductos = productos.length;

  const vencidos = productos.filter(p => p.estado === "vencido");
  const proximos = productos.filter(p => p.estado === "proximo" || Number(p.diasRestantes || 0) <= 7);
  const sinStock = productos.filter(p => Number(p.cantidad || 0) <= 0);

  const valorInventario = productos.reduce((acc, p) => {
    return acc + Number(p.cantidad || 0) * Number(p.costo || 0);
  }, 0);

  const capitalRiesgo = proximos.reduce((acc, p) => {
    return acc + Number(p.cantidad || 0) * Number(p.costo || 0);
  }, 0);

  let salud = 100;

  salud -= vencidos.length * 15;
  salud -= proximos.length * 7;
  salud -= sinStock.length * 10;

  salud = Math.max(0, Math.min(100, salud));

  const comprar = productos
    .filter(p => Number(p.cantidad || 0) <= 5 && p.estado !== "vencido")
    .slice(0, 5);

  const noComprar = productos
    .filter(p => p.estado === "vencido" || p.estado === "proximo" || Number(p.diasRestantes || 0) <= 10)
    .slice(0, 5);

  const usarPrimero = productos
    .filter(p => p.estado === "proximo" || Number(p.diasRestantes || 0) <= 7)
    .slice(0, 5);

  const saludo = obtenerSaludoInventarioGRUK();

  contenedor.innerHTML = `
    <div class="card">
      <h2>🧠 Asesor Empresarial GRUK</h2>

<p><strong>${saludo}.</strong></p>

<p>
  He analizado el estado actual de tu inventario y preparé las siguientes
  recomendaciones para ayudarte a reducir pérdidas, optimizar tus compras
  y mejorar la rentabilidad del restaurante.
</p>

      <h3>Inventario saludable: ${salud}%</h3>

      <p>
        GRUK detectó <strong>${totalProductos}</strong> productos registrados,
        con un valor total aproximado de
        <strong>${formatoCOP(valorInventario)}</strong>.
      </p>

      <p>
        Hay <strong>${proximos.length}</strong> producto(s) próximos a vencer,
        <strong>${vencidos.length}</strong> vencido(s) y
        <strong>${sinStock.length}</strong> sin stock.
      </p>

      <p>
        Capital en riesgo por vencimiento:
        <strong>${formatoCOP(capitalRiesgo)}</strong>.
      </p>

      <h3>✅ Usa primero</h3>
      ${
        usarPrimero.length
          ? `<ul>${usarPrimero.map(p => `<li>${p.nombre} — vence en ${p.diasRestantes} días</li>`).join("")}</ul>`
          : `<p>No hay productos urgentes para usar primero.</p>`
      }

      <h3>✔ Para el próximo mes compra</h3>
      ${
        comprar.length
          ? `<ul>${comprar.map(p => `<li>${p.nombre} — reponer stock (${p.cantidad} ${p.unidad || ""})</li>`).join("")}</ul>`
          : `<p>No hay compras urgentes detectadas.</p>`
      }

      <h3>❌ No compres por ahora</h3>
      ${
        noComprar.length
          ? `<ul>${noComprar.map(p => `<li>${p.nombre} — primero consume o revisa el inventario actual</li>`).join("")}</ul>`
          : `<p>No hay productos bloqueados para compra.</p>`
      }

      <h3>📌 Recomendación GRUK</h3>
      <p>
        Prioriza productos próximos a vencer, evita comprar más de los productos con baja salida
        y revisa las compras del próximo mes con base en stock real y vencimientos.
        Cuando conectemos el módulo de recetas, este diagnóstico podrá calcular consumo real por venta.
      </p>
    </div>
  `;
}

function obtenerSaludoInventarioGRUK() {
  const hora = new Date().getHours();

  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 18) return "Buenas tardes";
  return "Buenas noches";
}

function analizarVencimientosGRUK() {
  generarPlanInventarioMensualGRUK();
}

function analizarSobreProduccionGRUK() {
  diagnosticoInventarioGRUK();
}

function analizarTemporadasGRUK() {
  generarPlanInventarioMensualGRUK();
}

function analizarCapitalInventarioGRUK() {
  diagnosticoInventarioGRUK();
}