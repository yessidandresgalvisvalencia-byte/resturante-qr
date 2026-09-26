"use strict";

const PERFILES = Object.freeze({
  restaurante: Object.freeze({
    tipo: "restaurante",
    vertical: "restaurante",
    modulos: Object.freeze({
      restaurante: true,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  comercio: Object.freeze({
    tipo: "comercio",
    vertical: "comercio",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  retail: Object.freeze({
    tipo: "retail",
    vertical: "comercio",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  peluqueria: Object.freeze({
    tipo: "peluqueria",
    vertical: "servicios",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  barberia: Object.freeze({
    tipo: "barberia",
    vertical: "servicios",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  servicios: Object.freeze({
    tipo: "servicios",
    vertical: "servicios",
    modulos: Object.freeze({
      restaurante: false,
      inventario: false,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  taller: Object.freeze({
    tipo: "taller",
    vertical: "servicios_tecnicos",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  manufactura: Object.freeze({
    tipo: "manufactura",
    vertical: "manufactura",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  clinica: Object.freeze({
    tipo: "clinica",
    vertical: "servicios",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  }),
  otro: Object.freeze({
    tipo: "otro",
    vertical: "generico",
    modulos: Object.freeze({
      restaurante: false,
      inventario: true,
      finanzas: true,
      facturacion: true,
      laboral: false,
      inteligencia: true,
      gente: false,
      servicio_cliente: false
    })
  })
});

function normalizarTipoNegocio(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function resolverPerfilNegocio(
  tipoNegocio,
  empleadosActuales = null
) {
  const normalizado =
    normalizarTipoNegocio(tipoNegocio) ||
    "otro";

  const base =
    PERFILES[normalizado] ||
    {
      ...PERFILES.otro,
      tipo: normalizado,
      vertical: "generico"
    };

  const empleados =
    Number(empleadosActuales);

  const activarGente =
    Number.isFinite(empleados) &&
    empleados >= 15;

  return {
    tipo:
      base.tipo,
    vertical:
      base.vertical,
    modulos: {
      ...base.modulos,
      gente:
        activarGente ||
        Boolean(
          base.modulos.gente
        ),
      laboral:
        activarGente ||
        Boolean(
          base.modulos.laboral
        )
    }
  };
}

module.exports = {
  PERFILES,
  normalizarTipoNegocio,
  resolverPerfilNegocio
};
