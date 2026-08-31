let ingredientesRecetaGRUK = [];
let inventarioDisponibleGRUK = [];
let ultimaRecetaCalculadaGRUK = null;

function getRestaurantIdRecetasGRUK() {
  return getRestaurantId();
}
function formatoCOPReceta(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-CO");
}

async function inicializarRecetasGRUK() {

  ingredientesRecetaGRUK = [];

  ultimaRecetaCalculadaGRUK = null;

  await cargarInventarioParaRecetasGRUK();

  await cargarRecetasGuardadasGRUK();

  pintarIngredientesRecetaGRUK();

}

async function cargarInventarioParaRecetasGRUK() {
  const restaurantId = getRestaurantIdRecetasGRUK();

  try {
    const res = await grukFetch(`/api/inventario/${restaurantId}`);
    const data = await res.json();

    inventarioDisponibleGRUK = data.ok ? data.productos || [] : [];

    const select = document.getElementById("ingredienteInventario");
    if (!select) return;

    select.innerHTML = `
      <option value="">Selecciona ingrediente</option>
      ${inventarioDisponibleGRUK.map(item => `
        <option value="${item._id}">
          ${item.nombre} · ${item.cantidad} ${item.unidad || ""}
        </option>
      `).join("")}
    `;

  } catch (error) {
    console.error("Error cargando inventario para recetas:", error);
  }
}

function obtenerIngredienteSeleccionadoGRUK() {
  const id = document.getElementById("ingredienteInventario")?.value;

  return inventarioDisponibleGRUK.find(i => String(i._id) === String(id));
}

function calcularCostoIngredienteGRUK(itemInventario, cantidadUsada, unidadUsada) {
  const costoInventario = Number(itemInventario.costo || 0);
  const cantidadInventario = Number(itemInventario.cantidad || 1);

  const unidadInventario = String(itemInventario.unidad || "").toLowerCase();
  const unidad = String(unidadUsada || "").toLowerCase();

  let costoUnitario = costoInventario;

  if (
    unidadInventario.includes("kg") &&
    (unidad.includes("g") || unidad.includes("gramo"))
  ) {
    costoUnitario = costoInventario / 1000;
  }

  if (
    unidadInventario.includes("litro") &&
    (unidad.includes("ml") || unidad.includes("mililitro"))
  ) {
    costoUnitario = costoInventario / 1000;
  }

  if (
    unidadInventario.includes("unidad") ||
    unidadInventario.includes("unid")
  ) {
    costoUnitario = costoInventario;
  }

  return Number(cantidadUsada || 0) * costoUnitario;
}

function agregarIngredienteRecetaGRUK() {
  const item = obtenerIngredienteSeleccionadoGRUK();

  const cantidad = Number(document.getElementById("ingredienteCantidad")?.value || 0);
  const unidad = document.getElementById("ingredienteUnidad")?.value.trim();

  if (!item || cantidad <= 0 || !unidad) {
    alert("Selecciona ingrediente, cantidad y unidad.");
    return;
  }

  const costoTotal = calcularCostoIngredienteGRUK(item, cantidad, unidad);

  ingredientesRecetaGRUK.push({
    inventarioId: item._id,
    nombre: item.nombre,
    categoria: item.categoria,
    cantidad,
    unidad,
    costoUnitarioInventario: Number(item.costo || 0),
    unidadInventario: item.unidad,
    costoTotal
  });

  document.getElementById("ingredienteCantidad").value = "";
  document.getElementById("ingredienteUnidad").value = "";

  pintarIngredientesRecetaGRUK();
}

function eliminarIngredienteRecetaGRUK(index) {
  ingredientesRecetaGRUK.splice(index, 1);
  pintarIngredientesRecetaGRUK();
}

function pintarIngredientesRecetaGRUK() {
  const contenedor = document.getElementById("listaIngredientesReceta");
  if (!contenedor) return;

  if (!ingredientesRecetaGRUK.length) {
    contenedor.innerHTML = "<p>No hay ingredientes agregados.</p>";
    return;
  }

  contenedor.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th>Ingrediente</th>
          <th>Cantidad</th>
          <th>Unidad</th>
          <th>Costo</th>
          <th>Acción</th>
        </tr>
      </thead>

      <tbody>
        ${ingredientesRecetaGRUK.map((i, index) => `
          <tr>
            <td>${i.nombre}</td>
            <td>${i.cantidad}</td>
            <td>${i.unidad}</td>
            <td>${formatoCOPReceta(i.costoTotal)}</td>
            <td>
              <button onclick="eliminarIngredienteRecetaGRUK(${index})">
                Eliminar
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function calcularRecetaGRUK() {
  const nombre = document.getElementById("recetaNombre")?.value.trim();
  const categoria = document.getElementById("recetaCategoria")?.value;
  const porciones = Number(document.getElementById("recetaPorciones")?.value || 1);
  const tiempo = Number(document.getElementById("recetaTiempo")?.value || 0);
  const responsable = document.getElementById("recetaResponsable")?.value.trim();
  const precioVenta = Number(document.getElementById("recetaPrecioVenta")?.value || 0);
  const observaciones = document.getElementById("recetaObservaciones")?.value.trim();

  const manoObra = Number(document.getElementById("recetaManoObra")?.value || 0);
  const cis = Number(document.getElementById("recetaCIS")?.value || 0);

  if (!nombre || !ingredientesRecetaGRUK.length || porciones <= 0) {
    alert("Completa nombre, porciones e ingredientes.");
    return null;
  }

  const materiaPrima = ingredientesRecetaGRUK.reduce(
    (acc, i) => acc + Number(i.costoTotal || 0),
    0
  );

  const costoTotal = materiaPrima + manoObra + cis;
  const costoPorPorcion = costoTotal / porciones;

  const margenBruto = precioVenta > 0
    ? ((precioVenta - costoPorPorcion) / precioVenta) * 100
    : 0;

  const porcentajeMateriaPrima = costoTotal > 0
    ? (materiaPrima / costoTotal) * 100
    : 0;

  const porcentajeManoObra = costoTotal > 0
    ? (manoObra / costoTotal) * 100
    : 0;

  const porcentajeCIS = costoTotal > 0
    ? (cis / costoTotal) * 100
    : 0;

  ultimaRecetaCalculadaGRUK = {
    codigo: "REC-" + Date.now(),
    restaurantId: getRestaurantIdRecetasGRUK(),
    nombre,
    categoria,
    porciones,
    tiempo,
    responsable,
    precioVenta,
    observaciones,
    ingredientes: ingredientesRecetaGRUK,
    materiaPrima,
    manoObra,
    cis,
    costoTotal,
    costoPorPorcion,
    margenBruto,
    porcentajeMateriaPrima,
    porcentajeManoObra,
    porcentajeCIS,
    fecha: new Date().toISOString()
  };

  const contenedor = document.getElementById("resultadoCosteoReceta");

  if (contenedor) {
    contenedor.innerHTML = `
      <div class="card">
        <h3>📊 Conformación del costo</h3>

        <p><strong>Materia prima:</strong> ${formatoCOPReceta(materiaPrima)} (${porcentajeMateriaPrima.toFixed(2)}%)</p>
        <p><strong>Mano de obra:</strong> ${formatoCOPReceta(manoObra)} (${porcentajeManoObra.toFixed(2)}%)</p>
        <p><strong>CIS:</strong> ${formatoCOPReceta(cis)} (${porcentajeCIS.toFixed(2)}%)</p>

        <hr>

        <p><strong>Total costo:</strong> ${formatoCOPReceta(costoTotal)}</p>
        <p><strong>Costo por porción:</strong> ${formatoCOPReceta(costoPorPorcion)}</p>
        <p><strong>Precio de venta:</strong> ${formatoCOPReceta(precioVenta)}</p>
        <p><strong>Margen bruto:</strong> ${margenBruto.toFixed(2)}%</p>

        <button onclick="guardarRecetaGRUK()">
          Guardar receta estándar
        </button>
      </div>
    `;
  }

  return ultimaRecetaCalculadaGRUK;
}

async function guardarRecetaGRUK() {
  const receta = ultimaRecetaCalculadaGRUK || calcularRecetaGRUK();

  if (!receta) return;

  try {
    const res = await grukFetch("/api/recetas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(receta)
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || "No se pudo guardar la receta.");
      return;
    }

    mostrarToast(
    "Receta estándar guardada correctamente.",
    "success"
);

    limpiarRecetaGRUK();
    await cargarRecetasGuardadasGRUK();

  } catch (error) {
    console.error("Error guardando receta:", error);
    alert("Error conectando con el servidor.");
  }
}

async function cargarRecetasGuardadasGRUK() {
  const contenedor = document.getElementById("listaRecetasGRUK");
  if (!contenedor) return;

  const restaurantId = getRestaurantIdRecetasGRUK();

  try {
    const res = await grukFetch(`/api/recetas/${restaurantId}`);
    const data = await res.json();

    const recetas = data.ok ? data.recetas || [] : [];

    if (!recetas.length) {
      contenedor.innerHTML = "<p>No hay recetas registradas.</p>";
      return;
    }

    contenedor.innerHTML = recetas.map(r => `
      <div class="card">
        <h3>${r.nombre}</h3>
        <p><strong>Categoría:</strong> ${r.categoria}</p>
        <p><strong>Porciones:</strong> ${r.porciones}</p>
        <p><strong>Costo por porción:</strong> ${formatoCOPReceta(r.costoPorPorcion)}</p>
        <p><strong>Precio venta:</strong> ${formatoCOPReceta(r.precioVenta)}</p>
        <p><strong>Margen:</strong> ${Number(r.margenBruto || 0).toFixed(2)}%</p>

        <button onclick="verRecetaGRUK('${r._id}')">Ver</button>
        <button onclick="duplicarRecetaGRUK('${r._id}')">Duplicar</button>
        <button onclick="eliminarRecetaGRUK('${r._id}')">Eliminar</button>
      </div>
    `).join("");

  } catch (error) {
    console.error("Error cargando recetas:", error);
    contenedor.innerHTML = "<p>Error cargando recetas.</p>";
  }
}

async function verRecetaGRUK(id) {
  const res = await grukFetch(`/api/recetas/detalle/${id}`);
  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje || "No se pudo cargar la receta.");
    return;
  }

  const r = data.receta;
  const contenedor = document.getElementById("diagnosticoRecetaGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h2>📖 Receta estándar: ${r.nombre}</h2>

      <p><strong>Código:</strong> ${r.codigo}</p>
      <p><strong>Categoría:</strong> ${r.categoria}</p>
      <p><strong>Porciones:</strong> ${r.porciones}</p>
      <p><strong>Responsable:</strong> ${r.responsable || "-"}</p>

      <h3>Ingredientes</h3>
      <ul>
        ${r.ingredientes.map(i => `
          <li>${i.cantidad} ${i.unidad} de ${i.nombre} — ${formatoCOPReceta(i.costoTotal)}</li>
        `).join("")}
      </ul>

      <h3>Costos</h3>
      <p>Materia prima: ${formatoCOPReceta(r.materiaPrima)}</p>
      <p>Mano de obra: ${formatoCOPReceta(r.manoObra)}</p>
      <p>CIS: ${formatoCOPReceta(r.cis)}</p>
      <p>Total costo: ${formatoCOPReceta(r.costoTotal)}</p>
      <p>Costo por porción: ${formatoCOPReceta(r.costoPorPorcion)}</p>
      <p>Precio venta: ${formatoCOPReceta(r.precioVenta)}</p>
      <p>Margen: ${Number(r.margenBruto || 0).toFixed(2)}%</p>
    </div>
  `;
}

async function duplicarRecetaGRUK(id) {
  const res = await grukFetch(`/api/recetas/duplicar/${id}`, {
    method: "POST"
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje || "No se pudo duplicar.");
    return;
  }

  await cargarRecetasGuardadasGRUK();
}

async function eliminarRecetaGRUK(id) {
  if (!confirm("¿Eliminar esta receta?")) return;

  const res = await grukFetch(`/api/recetas/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje || "No se pudo eliminar.");
    return;
  }

  await cargarRecetasGuardadasGRUK();
}
function limpiarRecetaGRUK() {
  const ids = [
    "recetaNombre",
    "recetaTiempo",
    "recetaResponsable",
    "recetaPrecioVenta",
    "recetaObservaciones",
    "recetaManoObra",
    "recetaCIS"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("recetaPorciones").value = 1;

  ingredientesRecetaGRUK = [];
  ultimaRecetaCalculadaGRUK = null;

  pintarIngredientesRecetaGRUK();

  const resultado = document.getElementById("resultadoCosteoReceta");
  if (resultado) resultado.innerHTML = "";

  const diagnostico = document.getElementById("diagnosticoRecetaGRUK");
  if (diagnostico) diagnostico.innerHTML = "";
}

function generarDiagnosticoRecetaGRUK() {
  const receta = ultimaRecetaCalculadaGRUK || calcularRecetaGRUK();

  if (!receta) return;

  let estado = "🟢 Saludable";
  let recomendacion = "La receta presenta una estructura de costos razonable.";

  if (receta.margenBruto < 20) {
    estado = "🔴 Riesgosa";
    recomendacion =
      "El margen es bajo. GRUK recomienda revisar precio de venta, costo de materia prima o porción antes de vender este producto.";
  } else if (receta.margenBruto < 35) {
    estado = "🟡 Ajustable";
    recomendacion =
      "La receta puede ser rentable, pero necesita seguimiento. Conviene revisar ingredientes costosos o mejorar el precio.";
  } else if (receta.margenBruto >= 55) {
    estado = "🟢 Premium";
    recomendacion =
      "La receta tiene un margen fuerte. Puede funcionar como producto estratégico para mejorar rentabilidad.";
  }

  const contenedor = document.getElementById("diagnosticoRecetaGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h2>🧠 Asesor Empresarial GRUK</h2>

      <p><strong>${obtenerSaludoRecetaGRUK()}.</strong></p>

      <p>
        He analizado la receta estándar de <strong>${receta.nombre}</strong>
        y preparé las siguientes recomendaciones para ayudarte a controlar costos,
        proteger la rentabilidad y tomar mejores decisiones de precio.
      </p>

      <h3>Estado de la receta: ${estado}</h3>

      <p><strong>Costo por porción:</strong> ${formatoCOPReceta(receta.costoPorPorcion)}</p>
      <p><strong>Precio de venta:</strong> ${formatoCOPReceta(receta.precioVenta)}</p>
      <p><strong>Margen bruto:</strong> ${receta.margenBruto.toFixed(2)}%</p>

      <h3>Conformación del costo</h3>

      <p>Materia prima: ${receta.porcentajeMateriaPrima.toFixed(2)}%</p>
      <p>Mano de obra: ${receta.porcentajeManoObra.toFixed(2)}%</p>
      <p>CIS: ${receta.porcentajeCIS.toFixed(2)}%</p>

      <h3>Recomendación</h3>
      <p>${recomendacion}</p>

      <p>
        Cuando conectemos este módulo con ventas e inventario,
        GRUK podrá descontar automáticamente ingredientes,
        detectar variaciones de costo y recomendar compras futuras.
      </p>
    </div>
  `;
}

function obtenerSaludoRecetaGRUK() {
  const hora = new Date().getHours();

  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 18) return "Buenas tardes";
  return "Buenas noches";
}

function obtenerInventarioGRUK() {
  const restaurantId = getRestaurantId();
  return JSON.parse(localStorage.getItem(`inventario_${restaurantId}`)) || [];
}

function guardarInventarioGRUK(inventario) {
  const restaurantId = getRestaurantId();
  localStorage.setItem(`inventario_${restaurantId}`, JSON.stringify(inventario));
}

function agregarIngredienteRecetaGRUK() {
  const nombre = document.getElementById("ingredienteInventario").value.trim();
  const cantidad = Number(document.getElementById("ingredienteCantidad").value);
  const unidad = document.getElementById("ingredienteUnidad").value.trim();

  if (!nombre || cantidad <= 0 || !unidad) {
    alert("Completa ingrediente, cantidad y unidad.");
    return;
  }

  ingredientesRecetaGRUK.push({
    nombre,
    cantidad,
    unidad
  });

  document.getElementById("ingredienteInventario").value = "";
  document.getElementById("ingredienteCantidad").value = "";
  document.getElementById("ingredienteUnidad").value = "";

  mostrarIngredientesRecetaGRUK();
}

function mostrarIngredientesRecetaGRUK() {
  const contenedor = document.getElementById("listaIngredientesReceta");

  if (!ingredientesRecetaGRUK.length) {
    contenedor.innerHTML = "<p>No hay ingredientes agregados.</p>";
    return;
  }

  contenedor.innerHTML = ingredientesRecetaGRUK.map((i, index) => `
    <div class="card-mini">
      <strong>${i.nombre}</strong><br>
      Cantidad usada: ${i.cantidad} ${i.unidad}
      <br>
      <button onclick="eliminarIngredienteRecetaGRUK(${index})">
        Eliminar
      </button>
    </div>
  `).join("");
}

function eliminarIngredienteRecetaGRUK(index) {
  ingredientesRecetaGRUK.splice(index, 1);
  mostrarIngredientesRecetaGRUK();
}

function descontarInventarioPorRecetaGRUK(nombreReceta) {
  let inventario = obtenerInventarioGRUK();
  let movimientos = [];

  ingredientesRecetaGRUK.forEach(ingrediente => {
    const item = inventario.find(p =>
      p.nombre &&
      p.nombre.toLowerCase().trim() === ingrediente.nombre.toLowerCase().trim()
    );

    if (!item) {
      movimientos.push({
        producto: ingrediente.nombre,
        estado: "No encontrado",
        mensaje: `No se descontó ${ingrediente.nombre} porque no existe en inventario.`
      });
      return;
    }

    const cantidadAntes = Number(item.cantidad || 0);
    const cantidadUsada = Number(ingrediente.cantidad || 0);
    const cantidadNueva = cantidadAntes - cantidadUsada;

    item.cantidad = cantidadNueva < 0 ? 0 : cantidadNueva;

    if (!item.movimientos) item.movimientos = [];

    const justificacion = `Se descontaron ${cantidadUsada} ${ingrediente.unidad} de ${ingrediente.nombre} porque fue utilizado en la receta "${nombreReceta}".`;

    item.movimientos.push({
      tipo: "Salida por receta",
      receta: nombreReceta,
      cantidad: cantidadUsada,
      unidad: ingrediente.unidad,
      cantidadAntes,
      cantidadDespues: item.cantidad,
      fecha: new Date().toISOString(),
      justificacion
    });

    movimientos.push({
      producto: ingrediente.nombre,
      estado: "Descontado",
      cantidadAntes,
      cantidadUsada,
      cantidadDespues: item.cantidad,
      justificacion
    });
  });

  guardarInventarioGRUK(inventario);

  return movimientos;
}

function guardarRecetaGRUK() {
  const nombre = document.getElementById("recetaNombre").value.trim();

  if (!nombre) {
    alert("Escribe el nombre de la receta.");
    return;
  }

  if (!ingredientesRecetaGRUK.length) {
    alert("Agrega al menos un ingrediente.");
    return;
  }

  const movimientos = descontarInventarioPorRecetaGRUK(nombre);

  const receta = {
    id: Date.now(),
    nombre,
    categoria: document.getElementById("recetaCategoria").value,
    porciones: Number(document.getElementById("recetaPorciones").value || 1),
    tiempo: Number(document.getElementById("recetaTiempo").value || 0),
    responsable: document.getElementById("recetaResponsable").value.trim(),
    precioVenta: Number(document.getElementById("recetaPrecioVenta").value || 0),
    observaciones: document.getElementById("recetaObservaciones").value.trim(),
    ingredientes: ingredientesRecetaGRUK,
    movimientosInventario: movimientos,
    fecha: new Date().toISOString()
  };

  const restaurantId = getRestaurantId();
  const recetas = JSON.parse(localStorage.getItem(`recetas_${restaurantId}`)) || [];

  recetas.push(receta);

  localStorage.setItem(`recetas_${restaurantId}`, JSON.stringify(recetas));

  mostrarResultadoDescuentoGRUK(movimientos);

  ingredientesRecetaGRUK = [];
  mostrarIngredientesRecetaGRUK();

  alert("Receta guardada e inventario descontado correctamente.");
}

function mostrarResultadoDescuentoGRUK(movimientos) {
  const contenedor = document.getElementById("resultadoDescuentoInventarioGRUK");

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="card-mini">
      <h3>📦 Descuento aplicado al inventario</h3>
      ${movimientos.map(m => `
        <p>
          <strong>${m.producto}</strong><br>
          ${m.justificacion || m.mensaje}
        </p>
      `).join("")}
    </div>
  `;
}