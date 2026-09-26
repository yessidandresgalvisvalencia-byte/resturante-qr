const mongoose = require("mongoose");

const empresaSchema = new mongoose.Schema(
  {
    empresaId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    tipoNegocio: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      default: "restaurante"
    },

    correo: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    estado: {
      type: String,
      enum: [
        "activa",
        "inactiva",
        "suspendida"
      ],
      default: "activa"
    },

    verticalOperativa: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "generico",
      index: true
    },

    suscripcion: {
      plan: {
        type: String,
        default: "mensual"
      },
      precioMensual: {
        type: Number,
        min: 0,
        default: 220000
      },
      estado: {
        type: String,
        enum: [
          "pendiente",
          "activa",
          "inactiva"
        ],
        default: "pendiente",
        index: true
      },
      paymentSourceId: {
        type: String,
        default: ""
      },
      customerEmailWompi: {
        type: String,
        default: ""
      },
      tokenizacionCompleta: {
        type: Boolean,
        default: false
      },
      fechaUltimoPago: {
        type: Date,
        default: null
      },
      fechaProximoCobro: {
        type: Date,
        default: null
      },
      ultimoTransactionId: {
        type: String,
        default: ""
      }
    },

    configuracion: {
      moneda: {
        type: String,
        default: "COP"
      },

      pais: {
        type: String,
        default: "CO"
      },

      zonaHoraria: {
        type: String,
        default: "America/Bogota"
      },

            idioma: {
        type: String,
        default: "es"
      },

      // Objetivos empresariales para las neuronas GRUK.
      // Sin metas ficticias para empresas existentes.
      margen_objetivo: {
        type: Number,
        min: 0,
        max: 100,
        default: null
      },

      punto_equilibrio: {
        type: Number,
        min: 0,
        default: null
      },

      ticket_objetivo: {
        type: Number,
        min: 0,
        default: null
      },

      cac_maximo: {
        type: Number,
        min: 0,
        default: null
      },

      empleados_actuales: {
        type: Number,
        min: 0,
        default: null
      },

      inteligencia_base_actualizadaAt: {
        type: Date,
        default: null
      },

      inteligencia_base_actualizadaBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        default: null
      },

      politica_financiera: {
        distribucion_dueno: {
          habilitada: {
            type: Boolean,
            default: false
          },
          porcentaje_utilidad: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },
          reserva_minima_caja: {
            type: Number,
            min: 0,
            default: 0
          },
          updatedAt: {
            type: Date,
            default: null
          },
          updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Usuario",
            default: null
          }
        },

        priorizacion_pagos: {
          usar_precedencia_categoria: {
            type: Boolean,
            default: false
          },
          precedencia_categorias: {
            type: [{
              type: String,
              enum: [
                "NOMINA",
                "IMPUESTOS",
                "DEUDA",
                "ARRIENDO",
                "SERVICIOS",
                "SEGUROS",
                "LICENCIAS",
                "PROVEEDORES",
                "OTRO"
              ]
            }],
            default: []
          },
          updatedAt: {
            type: Date,
            default: null
          },
          updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Usuario",
            default: null
          }
        }
      }
    },

    modulos: {
      restaurante: {
        type: Boolean,
        default: false
      },

      inventario: {
        type: Boolean,
        default: true
      },

      finanzas: {
        type: Boolean,
        default: true
      },

      facturacion: {
        type: Boolean,
        default: false
      },

      laboral: {
        type: Boolean,
        default: false
      },

      inteligencia: {
        type: Boolean,
        default: true
      },

      gente: {
        type: Boolean,
        default: false
      },

      servicio_cliente: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Empresa", empresaSchema);