const params = new URLSearchParams(window.location.search);
const restaurantId =
  params.get("restaurantId") ||
  params.get("restaurant") ||
  "rest1";

const modoDashboard = params.get("modo") || "automatico";
function obtenerInteligenciaDashboardGRUK(restaurantId) {
  return (
    JSON.parse(
      localStorage.getItem(`inteligenciaGRUK_${restaurantId}`)
    ) || {}
  );
}

function generarContextoEstrategicoDashboardGRUK(i) {
  if (!i || Object.keys(i).length === 0) {
    return "";
  }

  return `
    <div class="strategy-card">
      <h3>Contexto Comercial Detectado GRUK</h3>

      <p><strong>Competencia:</strong> ${i.competencia || "No configurada"}</p>
      <p><strong>Ciudad:</strong> ${i.ciudad || "No configurada"}</p>
      <p><strong>Temporada:</strong> ${i.temporada || "No configurada"}</p>
      <p><strong>Marketing:</strong> ${i.marketing || "No configurado"}</p>
      <p><strong>Percepción de valor:</strong> ${i.valor || "No configurada"}</p>

      <p><strong>Meta mensual de ventas:</strong> ${formatoMoneda(i.metaVentasMensual || 0)}</p>
      <p><strong>Meta mensual de utilidad:</strong> ${formatoMoneda(i.metaUtilidadMensual || 0)}</p>

      <p>
        GRUK adaptará las estrategias comerciales del dashboard según estas metas,
        manteniendo su naturaleza original: incrementar ventas sin destruir margen.
      </p>
    </div>
  `;
}

async function obtenerDatosPareto() {
  if (modoDashboard === "manual") {
    const datosManuales =
      JSON.parse(localStorage.getItem(`dashboard_manual_${restaurantId}`)) || [];

    return datosManuales.sort(
      (a, b) => Number(b.ventas || 0) - Number(a.ventas || 0)
    );
  }

  const respuesta = await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

  if (!respuesta.ok) {
    throw new Error("No se pudo cargar /estadisticas/pareto");
  }

  return await respuesta.json();
}

function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(valor || 0);
}

function limpiarTexto(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tipoProducto(nombre = "") {
  const n = limpiarTexto(nombre);

  if (
    n.includes("coca") ||
    n.includes("gaseosa") ||
    n.includes("limonada") ||
    n.includes("jugo") ||
    n.includes("agua") ||
    n.includes("bebida")
  ) return "bebida";

  if (
    n.includes("papa") ||
    n.includes("papas") ||
    n.includes("yuca") ||
    n.includes("arroz") ||
    n.includes("ensalada") ||
    n.includes("aguacate") ||
    n.includes("arepa")
  ) return "acompanante";

  if (
    n.includes("empanada") ||
    n.includes("entrada") ||
    n.includes("picada") ||
    n.includes("chorizo") ||
    n.includes("morcilla")
  ) return "entrada";

  if (
    n.includes("sancocho") ||
    n.includes("sopa") ||
    n.includes("ajiaco") ||
    n.includes("mondongo")
  ) return "tradicional";

  if (
    n.includes("carne") ||
    n.includes("punta") ||
    n.includes("anca") ||
    n.includes("pollo") ||
    n.includes("chuzo") ||
    n.includes("asada") ||
    n.includes("lomo") ||
    n.includes("costilla")
  ) return "plato_fuerte";

  if (
    n.includes("hamburguesa") ||
    n.includes("pizza") ||
    n.includes("perro") ||
    n.includes("salchipapa")
  ) return "comida_rapida";

  if (
    n.includes("helado") ||
    n.includes("postre") ||
    n.includes("torta") ||
    n.includes("brownie")
  ) return "postre";

  return "producto";
}

function estimarMargenPorProducto(producto = "", ticket = 0) {
  const n = limpiarTexto(producto);

  if (n.includes("empanada") || n.includes("arepa") || n.includes("papa")) return 18;
  if (n.includes("bebida") || n.includes("gaseosa") || n.includes("agua")) return 35;
  if (n.includes("carne") || n.includes("lomo") || n.includes("punta") || n.includes("asada")) return 58;
  if (n.includes("picada") || n.includes("premium")) return 62;
  if (n.includes("hamburguesa") || n.includes("pizza")) return 42;
  if (n.includes("postre") || n.includes("torta")) return 45;

  if (ticket >= 45000) return 60;
  if (ticket >= 30000) return 48;
  if (ticket >= 18000) return 32;

  return 18;
}

function clasificarRolEconomico({ ventas, margen, participacion }) {
  if (participacion >= 50 && margen <= 25) {
    return "producto_ancla";
  }

  if (participacion >= 20 && margen >= 45) {
    return "producto_estrella";
  }

  if (participacion < 15 && margen >= 50) {
    return "producto_diamante";
  }

  if (participacion < 5 && margen < 25) {
    return "capital_muerto";
  }

  if (participacion >= 15 && margen < 30) {
    return "producto_trafico";
  }

  return "producto_equilibrado";
}

function enriquecerDatos(datos) {
  const totalPedidos = datos.reduce(
    (acc, item) => acc + Number(item.ventas || 0),
    0
  );

  return datos.map(item => {
    const producto = item.producto || "Producto sin nombre";
    const ventas = Number(item.ventas || 0);


const precioUnitario =
  Number(
    item.precioUnitarioActual ||
    item.precio ||
    item.precioActual ||
    item.precioVenta ||
    item.precio_unitario ||
    item.valorUnitario ||
    item.valor ||
    0
  );

const totalDinero =
  Number(
    item.totalCalculado ||
    item.totalDinero ||
    item.total ||
    item.ingresos ||
    item.valorTotal ||
    item.precioTotal ||
    0
  ) || (precioUnitario * ventas);

const ticket =
  ventas > 0
    ? totalDinero / ventas
    : precioUnitario;

const costoMateriaPrimaUnitario =
  Number(item.costoMateriaPrimaUnitario || 0);

const margen =
  precioUnitario > 0
    ? Number(
        (((precioUnitario - costoMateriaPrimaUnitario) / precioUnitario) * 100).toFixed(1)
      )
    : estimarMargenPorProducto(producto, ticket);

const participacion =
  totalPedidos > 0 ? Number(((ventas / totalPedidos) * 100).toFixed(1)) : 0;
  
    const rolEconomico = clasificarRolEconomico({
      ventas,
      margen,
      participacion
    });

    return {
      ...item,
      producto,
      ventas,
      totalDinero,
      ticket,
      margen,
      participacion,
      rolEconomico,
      tipo: tipoProducto(producto)
    };
  });
}

function esCompatible(a, b) {
  if (!a || !b) return false;
  if (a.producto === b.producto) return false;

  const t1 = a.tipo;
  const t2 = b.tipo;

  if (t1 === "bebida" && t2 === "bebida") return false;
  if (t1 === "acompanante" && t2 === "acompanante") return false;
  if (t1 === "postre" && ["plato_fuerte", "tradicional"].includes(t2)) return false;
  if (t2 === "postre" && ["plato_fuerte", "tradicional"].includes(t1)) return false;

  return true;
}

function buscarComplementoCompatible(base, datos) {
  if (!base || !datos.length) return null;

  const candidatos = datos
    .filter(item => esCompatible(base, item))
    .sort((a, b) => {
      const puntajeA =
        Number(a.margen || 0) * 0.6 +
        Number(a.ticket || 0) * 0.0004 +
        Number(a.participacion || 0) * 0.4;

      const puntajeB =
        Number(b.margen || 0) * 0.6 +
        Number(b.ticket || 0) * 0.0004 +
        Number(b.participacion || 0) * 0.4;

      return puntajeB - puntajeA;
    });

  return candidatos[0] || null;
}

function obtenerParesCompatibles(datos, maximo = 4) {
  const pares = [];

  for (let i = 0; i < datos.length; i++) {
    for (let j = i + 1; j < datos.length; j++) {
      if (esCompatible(datos[i], datos[j])) {
        pares.push([datos[i], datos[j]]);
      }
    }
  }

  return pares.slice(0, maximo);
}

function hayEmpateReal(datos) {
  if (datos.length < 2) return false;
  return Number(datos[0].ventas || 0) === Number(datos[1].ventas || 0);
}

function random(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function nombreRolProducto(producto) {
  switch (producto.rolEconomico) {
    case "producto_ancla":
      return "Eje de atracción comercial";
    case "producto_estrella":
      return "Eje de rentabilidad";
    case "producto_diamante":
      return "Producto diamante estratégico";
    case "capital_muerto":
      return "Producto a evaluación crítica";
    case "producto_trafico":
      return "Producto de circulación";
    default:
      return "Producto equilibrado";
  }
}

function explicarRolProducto(producto) {
  if (producto.rolEconomico === "producto_ancla") {
    return `${producto.producto} funciona como producto gancho: atrae tráfico, mueve pedidos y valida la demanda del restaurante. Su valor no está en acumular grandes márgenes por unidad, sino en abrir la puerta para que el cliente compre productos de mayor rentabilidad.`;
  }

  if (producto.rolEconomico === "producto_estrella") {
    return `${producto.producto} combina aceptación del mercado con margen atractivo. Este tipo de producto debe recibir visibilidad prioritaria porque cada venta contribuye con más fuerza al crecimiento de caja.`;
  }

  if (producto.rolEconomico === "producto_diamante") {
    return `${producto.producto} no necesariamente rota con la misma velocidad que un producto popular, pero tiene capacidad de elevar el ticket y generar acumulación rentable cuando se presenta correctamente.`;
  }

  if (producto.rolEconomico === "capital_muerto") {
    return `${producto.producto} muestra baja rotación y bajo margen estimado. En términos operativos puede estar inmovilizando inventario, espacio visual y atención del cliente sin devolver suficiente valor.`;
  }

  return `${producto.producto} mantiene un comportamiento intermedio. Debe medirse mejor antes de asignarle una función dominante dentro del menú.`;
}

async function cargarDashboard() {
  try {
    let datos = await obtenerDatosPareto();
    datos = enriquecerDatos(datos);
    const inteligenciaGRUK =
  obtenerInteligenciaDashboardGRUK(restaurantId);

const contextoGRUK =
  generarContextoEstrategicoDashboardGRUK(inteligenciaGRUK);

    if (!datos || datos.length === 0) {
      document.getElementById("recomendaciones").innerHTML = `
        <div class="recommendation warning">
          No hay datos suficientes para generar recomendaciones.
        </div>
      `;
      return;
    }

    const productos = datos.map(item => item.producto);
    const ventas = datos.map(item => Number(item.ventas || 0));
    const dinero = datos.map(item => Number(item.totalDinero || 0));

    const totalPedidos = ventas.reduce((a, b) => a + b, 0);
    const totalDinero = dinero.reduce((a, b) => a + b, 0);
    const ticketPromedio = totalPedidos > 0 ? totalDinero / totalPedidos : 0;
    const productoTop = datos[0];

    document.getElementById("totalVentas").textContent = formatoMoneda(totalDinero);
    document.getElementById("totalPedidos").textContent = totalPedidos;
    document.getElementById("topProducto").textContent = productoTop.producto;
    document.getElementById("totalProductos").textContent = datos.length;
    document.getElementById("ticketPromedio").textContent = formatoMoneda(ticketPromedio);

    const total = ventas.reduce((a, b) => a + b, 0);
    let acumulado = 0;

    const porcentajeAcumulado = ventas.map(valor => {
      acumulado += valor;
      return total > 0 ? Number(((acumulado / total) * 100).toFixed(2)) : 0;
    });

    const canvas = document.getElementById("graficaProductos");

    new Chart(canvas, {
      data: {
        labels: productos,
        datasets: [
          {
            type: "bar",
            label: "Cantidad vendida",
            data: ventas,
            yAxisID: "y"
          },
          {
            type: "line",
            label: "% acumulado",
            data: porcentajeAcumulado,
            yAxisID: "y1",
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#ffffff" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#cbd5e1" },
            grid: { color: "rgba(255,255,255,0.06)" }
          },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: { color: "#cbd5e1" },
            title: {
              display: true,
              text: "Cantidad vendida",
              color: "#cbd5e1"
            },
            grid: { color: "rgba(255,255,255,0.08)" }
          },
          y1: {
            beginAtZero: true,
            max: 100,
            position: "right",
            ticks: { color: "#cbd5e1" },
            title: {
              display: true,
              text: "% acumulado",
              color: "#cbd5e1"
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    cargarRecomendacionesSmith(datos, totalPedidos, ticketPromedio);

  } catch (error) {
    console.error(error);
    document.getElementById("recomendaciones").innerHTML = `
      <div class="recommendation warning">
        Error cargando el dashboard. Revisa los datos manuales o la ruta de estadísticas.
      </div>
    `;
  }
}

function aplicarEstrategia(numero, titulo, productos = []) {
  const estrategiasGuardadas =
    JSON.parse(localStorage.getItem(`estrategias_${restaurantId}`)) || [];

  const yaExiste =
    estrategiasGuardadas.find(e => e.numero === numero);

  if (!yaExiste) {
    estrategiasGuardadas.push({
      numero,
      titulo,
      productos,
      fecha: new Date().toISOString()
    });
  }

  localStorage.setItem(
    `estrategias_${restaurantId}`,
    JSON.stringify(estrategiasGuardadas)
  );

  alert(`Estrategia ${numero} aplicada correctamente`);

  window.location.href =
    `/admin.html?restaurantId=${restaurantId}`;
}

function aplicarTodasLasEstrategias() {
  const botones =
    document.querySelectorAll("[data-estrategia]");

  botones.forEach(btn => {
    const numero = btn.dataset.estrategia;
    const titulo = btn.dataset.titulo;
    const productos =
      JSON.parse(btn.dataset.productos || "[]");

    const estrategiasGuardadas =
      JSON.parse(localStorage.getItem(`estrategias_${restaurantId}`)) || [];

    const yaExiste =
      estrategiasGuardadas.find(e => e.numero === numero);

    if (!yaExiste) {
      estrategiasGuardadas.push({
        numero,
        titulo,
        productos,
        fecha: new Date().toISOString()
      });
    }

    localStorage.setItem(
      `estrategias_${restaurantId}`,
      JSON.stringify(estrategiasGuardadas)
    );
  });

  alert("Todas las estrategias fueron aplicadas");

  window.location.href =
    `/admin.html?restaurantId=${restaurantId}`;
}

function cargarRecomendacionesSmith(datos, totalPedidos, ticketPromedio) {
  const contenedor = document.getElementById("recomendaciones");

  const top = datos[0];
  const segundo = datos[1];
  const tercero = datos[2];

  const empate = hayEmpateReal(datos);
  const complemento = buscarComplementoCompatible(top, datos);
  const pares = obtenerParesCompatibles(datos, 4);

  const bajaRotacion = datos.filter(p => Number(p.participacion || 0) < 5);

  const productosValidados = datos.filter(p => {
    return Number(p.participacion || 0) >= 15;
  });

  const productosCapitalMuerto = datos.filter(p => {
    return p.rolEconomico === "capital_muerto";
  });

  const productosDiamante = datos.filter(p => {
    return p.rolEconomico === "producto_diamante";
  });

  const productoAncla =
    datos.find(p => p.rolEconomico === "producto_ancla") ||
    top;

  const productoRentable =
    datos.find(p => p.rolEconomico === "producto_estrella") ||
    datos.find(p => p.rolEconomico === "producto_diamante") ||
    complemento;
    const inteligencia =
  obtenerInteligenciaDashboardGRUK(restaurantId);
  const contextoGRUK =
  generarContextoEstrategicoDashboardGRUK(inteligencia);
  let html = contextoGRUK; 

const metaVentas =
  Number(inteligencia.metaVentasMensual || 0);

const metaUtilidad =
  Number(inteligencia.metaUtilidadMensual || 0);

const temporada =
  inteligencia.temporada || "normal";

const competencia =
  inteligencia.competencia || "similar";

const marketing =
  inteligencia.marketing || "medio";

const ciudad =
  inteligencia.ciudad || "";

const valor =
  inteligencia.valor || "media";



  if (empate) {
    const par1 = pares[0];
    const par2 = pares[1];

    html += `
      <div class="recommendation warning">
        <span class="strategy-label">Estrategia 1 · Lectura objetiva del mercado</span>
        <h3>1. Probar antes de declarar un producto ganador</h3>
        <p>
          Las ventas están muy parejas. GRUK no debe inventar un producto líder cuando el mercado todavía no lo ha definido.
        </p>
        <p>
          <strong>Acción experta:</strong> realizar una prueba de 7 días con combinaciones coherentes.
          ${par1 ? `Primera prueba: <strong>${par1[0].producto} + ${par1[1].producto}</strong>.` : ""}
          ${par2 ? ` Segunda prueba: <strong>${par2[0].producto} + ${par2[1].producto}</strong>.` : ""}
        </p>
        <p>
          <strong>Por qué funcionaría:</strong> la decisión se basa en mercado real, no en intuición. El cliente revela qué combinación tiene mayor valor.
        </p>
      </div>
    `;
  } else {
    const tituloTop =
      top.rolEconomico === "producto_ancla"
        ? `Posicionar ${top.producto} como eje de atracción comercial`
        : top.rolEconomico === "producto_estrella"
          ? `Posicionar ${top.producto} como eje de rentabilidad`
          : top.rolEconomico === "producto_diamante"
            ? `Reconvertir ${top.producto} en producto diamante`
            : `Definir el rol económico de ${top.producto}`;

    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 1 · Producto ancla y especialización</span>
        <h3>1. ${tituloTop}</h3>

        <p>
          <strong>${top.producto}</strong> representa aproximadamente
          <strong>${top.participacion}%</strong> de los pedidos, con un margen estimado de
          <strong>${top.margen}%</strong>. Su rol actual es:
          <strong>${nombreRolProducto(top)}</strong>.
        </p>

        <p>
          <strong>Diagnóstico:</strong> ${explicarRolProducto(top)}
        </p>

        <p>
          <strong>Acción experta:</strong>
          ${
            top.rolEconomico === "producto_ancla"
              ? `mantener su operación muy eficiente, pero restringir su promoción aislada. Debe usarse como puerta de entrada para empujar platos con mayor margen.`
              : top.rolEconomico === "producto_estrella"
                ? `concentrar visibilidad, fotografía, ubicación superior y recomendación automática sobre este producto porque combina aceptación con acumulación rentable.`
                : top.rolEconomico === "producto_diamante"
                  ? `no tratarlo como fracaso por vender menos. Debe reposicionarse con mejor foto, nombre premium y venta sugerida en momentos de mayor intención de compra.`
                  : `medirlo durante 7 días más antes de darle el espacio principal del menú.`
          }
        </p>

        <p>
          <strong>Por qué funciona:</strong>
          GRUK separa volumen de riqueza. Un producto puede traer muchos clientes sin ser el que más fortalece la caja. La estrategia correcta es usar la rotación para atraer mercado y el margen para acumular capital.
        </p>
      </div>
    `;
  }

  if (complemento) {
    const ticketCombinado =
      Number(top.ticket || 0) + Number(complemento.ticket || 0);

    const incrementoTicket =
      top.ticket > 0
        ? (((ticketCombinado - top.ticket) / top.ticket) * 100).toFixed(1)
        : 0;

    const margenCombinado =
      Number(((Number(top.margen || 0) + Number(complemento.margen || 0)) / 2).toFixed(1));

    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 2 · Subsidio cruzado inteligente</span>
        <h3>2. Combinar volumen con rentabilidad real</h3>

        <p>
          GRUK detectó una oportunidad combinando
          <strong>${top.producto}</strong>
          con
          <strong>${complemento.producto}</strong>.
        </p>

        <p>
          <strong>Lectura económica:</strong>
          ${
            top.rolEconomico === "producto_ancla" || top.rolEconomico === "producto_trafico"
              ? `${top.producto} actúa como producto de entrada: mueve tráfico y genera intención de compra. ${complemento.producto} puede absorber mejor el costo operativo porque tiene mayor valor percibido o mejor margen.`
              : `${top.producto} ya tiene fuerza comercial. Al combinarlo con ${complemento.producto}, el restaurante puede elevar el ticket sin depender de descuentos agresivos.`
          }
        </p>

        <p>
          <strong>Acción experta:</strong>
          sugerir esta combinación justo antes de cerrar el pedido digital. El cliente ya tiene intención de compra; ese es el mejor momento para elevar el valor del pedido.
        </p>

        <p>
          <strong>Impacto proyectado:</strong>
          el ticket pasaría de aproximadamente
          <strong>${formatoMoneda(top.ticket)}</strong>
          a
          <strong>${formatoMoneda(ticketCombinado)}</strong>,
          con una mejora estimada del
          <strong>${incrementoTicket}%</strong>.
          Margen combinado estimado:
          <strong>${margenCombinado}%</strong>.
        </p>

        <p>
          <strong>Por qué funciona:</strong>
          el producto de alto volumen reduce fricción de entrada, mientras el producto de mayor valor ayuda a convertir tráfico en utilidad. Esta es la forma correcta de usar un producto popular sin confundirlo con el verdadero acumulador de caja.
        </p>
      </div>
    `;
  }

  if (productosValidados.length >= 2) {
    const productosParaAplicar =
      productosValidados.map(p => p.producto);

    const nombresValidados =
      productosValidados
        .map(p => `<strong>${p.producto}</strong> (${p.participacion}%)`)
        .join(", ");

    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 3 · Competencia interna del menú</span>
        <h3>3. Filtrar la sección “Los más pedidos” con datos reales</h3>

        <button
          data-estrategia="3"
          data-titulo="Los más pedidos validados por el mercado"
          data-productos='${JSON.stringify(productosParaAplicar)}'
          onclick='aplicarEstrategia(
            3,
            "Los más pedidos validados por el mercado",
            ${JSON.stringify(productosParaAplicar)}
          )'>
          Aplicar estrategia 3
        </button>

        <p>
          El análisis demuestra que solo estos productos superaron el umbral mínimo de aceptación comercial:
          ${nombresValidados}.
        </p>

        <p>
          <strong>Acción experta:</strong>
          ubicar únicamente estos productos en la zona superior del menú digital. Los productos con baja rotación no deben aparecer como “más pedidos”, porque eso rompe la confianza del cliente y del administrador.
        </p>

        <p>
          <strong>Por qué funciona:</strong>
          el menú debe dejar que los datos del mercado compitan por la visibilidad. Mostrar productos lentos junto a productos fuertes contamina la decisión del cliente y dispersa la atención comercial.
        </p>
      </div>
    `;
  }

  html += `
    <div class="recommendation">
      <span class="strategy-label">Estrategia 4 · Precio, valor y margen</span>
      <h3>4. Proteger precio sin destruir percepción de valor</h3>

      <p>
        GRUK no recomienda descuentos generales como primera salida. Un descuento mal aplicado puede aumentar ventas aparentes, pero debilitar margen, entrenar al cliente a esperar rebajas y reducir el valor percibido del menú.
      </p>

      <p>
        <strong>Acción experta:</strong>
        si se lanza una promoción, debe estar amarrada a productos compatibles, tener duración limitada y medirse contra ticket promedio, margen estimado y rotación.
      </p>

      <p>
        <strong>Por qué funciona:</strong>
        vender más no siempre significa ganar más. La estrategia correcta es elevar valor percibido, no competir únicamente por precio.
      </p>
    </div>

    <div class="recommendation">
      <span class="strategy-label">Estrategia 5 · Capital circulante e inventario</span>
      <h3>5. Acelerar inventario que sí se convierte en caja</h3>

      <p>
        Los productos de alta rotación ayudan a mover inventario y recuperar dinero operativo. Pero si el margen es bajo, deben trabajar como canal de entrada y no como única fuente de crecimiento.
      </p>

      <p>
        <strong>Acción experta:</strong>
        usar productos de tráfico para sostener flujo constante, pero conectarlos con productos de mayor margen mediante combos, recomendaciones y mejoras visuales.
      </p>

      <p>
        <strong>Por qué funciona:</strong>
        un restaurante crece cuando convierte inventario en efectivo de forma constante y reinvierte en lo que realmente aumenta capacidad de caja.
      </p>
    </div>

    <div class="recommendation">
      <span class="strategy-label">Estrategia 6 · Empatía comercial</span>
      <h3>6. Hacer que el menú venda antes de que el cliente pregunte</h3>

      <p>
        El cliente no compra únicamente comida; compra confianza, antojo, seguridad y percepción de valor. Una mala foto o una descripción débil puede convertir un producto rentable en un producto invisible.
      </p>

      <p>
        <strong>Acción experta:</strong>
        mejorar fotos, nombres y descripciones de productos con buen margen, especialmente los que no rotan suficiente pero pueden elevar el ticket.
      </p>

      <p>
        <strong>Por qué funciona:</strong>
        el menú digital debe traducir el valor económico del plato en deseo visual y claridad de compra.
      </p>
    </div>
  `;

  if (bajaRotacion.length > 0) {
    html += `
      <div class="recommendation danger">
        <span class="strategy-label">Estrategia 7 · Evaluación objetiva del menú</span>
        <h3>7. Separar productos rescatables de capital muerto</h3>

        <ul>
          ${bajaRotacion.map(p => `
            <li>
              <strong>${p.producto}</strong>:
              ${p.ventas} ventas,
              ${p.participacion}% de participación,
              margen estimado ${p.margen}%.
              Rol: ${nombreRolProducto(p)}.
            </li>
          `).join("")}
        </ul>

        <p>
          <strong>Acción experta:</strong>
          ${
            productosCapitalMuerto.length > 0
              ? `los productos con baja rotación y bajo margen deben revisarse con urgencia: pueden estar ocupando inventario, espacio visual y atención sin devolver valor suficiente.`
              : `los productos de baja rotación no deben eliminarse automáticamente. Si tienen buen margen, pueden rescatarse con mejor presentación, ubicación o venta cruzada.`
          }
        </p>

        <p>
          <strong>Por qué funciona:</strong>
          el sistema no decide por capricho. Distingue entre un producto lento pero valioso y un producto que realmente inmoviliza capital.
        </p>
      </div>
    `;
  }

  if (productosDiamante.length > 0) {
    html += `
      <div class="recommendation">
        <span class="strategy-label">Estrategia 8 · Productos diamante</span>
        <h3>8. Rescatar platos de alto margen que el cliente aún no está viendo</h3>

        <p>
          GRUK detectó productos con margen atractivo pero baja rotación:
          ${productosDiamante.map(p => `<strong>${p.producto}</strong>`).join(", ")}.
        </p>

        <p>
          <strong>Acción experta:</strong>
          no esconderlos ni eliminarlos. Deben recibir mejor foto, nombre más vendedor, descripción más emocional y ubicación estratégica como recomendación premium.
        </p>

        <p>
          <strong>Por qué funciona:</strong>
          algunos productos no fallan por falta de valor, sino por falta de exposición correcta. Un producto diamante puede vender menos unidades, pero cada venta fortalece más la caja.
        </p>
      </div>
    `;
  }

  html += `
    <div class="recommendation">
      <span class="strategy-label">Base económica aplicada</span>
      <h3>Cómo GRUK está pensando la estrategia</h3>

      <p>
        GRUK separa popularidad, margen, rotación, ticket, inventario y visibilidad. Por eso no trata igual a un producto que atrae clientes que a un producto que acumula rentabilidad.
      </p>

      <p>
        El sistema interpreta el menú como un mercado interno: los productos compiten por atención, los clientes revelan preferencia con sus pedidos y el restaurante debe asignar visibilidad según datos, no por intuición.
      </p>

      <p>
        La lógica central es simple: usar productos de alto volumen para atraer demanda, productos de alto margen para fortalecer caja y productos de baja rotación para decidir si se rescatan, se transforman o se retiran.
      </p>
    </div>

    <div class="recommendation">
      <h3>Aplicar estrategias</h3>

      <button onclick="aplicarTodasLasEstrategias()">
        Aplicar todas
      </button>
    </div>
  `;

  contenedor.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", cargarDashboard);