"use strict";

const mongoose = require("mongoose");

const hallazgoSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      required: true,
      trim: true
    },

    evidencia: {
      type: String,
      required: true,
      trim: true
    },

    impacto_financiero_estimado: {
      type: Number,
      required: true,
      default: 0
    },

    confianza: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  },
  {
    _id: false
  }
);

const kpiPrincipalSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true
    },

    valor_actual: {
      type: Number,
      default: null
    },

    valor_objetivo: {
      type: Number,
      default: null
    },

    estado: {
      type: String,
      required: true,
      enum: [
        "OK",
        "ALERTA",
        "CRITICO"
      ]
    }
  },
  {
    _id: false
  }
);

const periodoSchema = new mongoose.Schema(
  {
    desde: {
      type: Date,
      required: true
    },

    hasta: {
      type: Date,
      required: true
    }
  },
  {
    _id: false
  }
);

const cerebroReporteNeuronaSchema =
  new mongoose.Schema(
    {
      neurona: {
        type: String,
        required: true,
        enum: [
          "FINANZAS",
          "VENTAS",
          "MARKETING",
          "OPERACIONES",
          "GENTE"
        ],
        index: true
      },

      empresaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Empresa",
        required: true,
        index: true
      },

      sedeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sede",
        default: null,
        index: true
      },

      periodo: {
        type: periodoSchema,
        required: true
      },

      timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
      },

      kpi_principal: {
        type: kpiPrincipalSchema,
        required: true
      },

      hallazgos: {
        type: [hallazgoSchema],
        default: []
      },

      necesita_decision_de_cerebro: {
        type: Boolean,
        required: true,
        default: false
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        default: null
      },

      deletedAt: {
        type: Date,
        default: null,
        index: true
      }
    },
    {
      timestamps: true,
      collection: "cerebro_reportes_neuronas"
    }
  );

cerebroReporteNeuronaSchema.index({
  empresaId: 1,
  neurona: 1,
  timestamp: -1
});

cerebroReporteNeuronaSchema.index({
  empresaId: 1,
  "kpi_principal.estado": 1,
  timestamp: -1
});

module.exports =
  mongoose.models.CerebroReporteNeurona ||
  mongoose.model(
    "CerebroReporteNeurona",
    cerebroReporteNeuronaSchema
  );