"use strict";

const RESPUESTA_EXPERTA_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["respuestas"],
  properties: {
    respuestas: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "departamento",
          "respuesta",
          "criterio_profesional",
          "evidencia_usada",
          "inferencias",
          "riesgos",
          "objeciones",
          "acuerdos",
          "datos_faltantes",
          "confianza"
        ],
        properties: {
          departamento: {
            type: "string",
            enum: [
              "FINANZAS",
              "VENTAS",
              "MARKETING",
              "OPERACIONES",
              "GENTE",
              "DIRECCION"
            ]
          },
          respuesta: {
            type: "string",
            minLength: 1,
            maxLength: 1800
          },
          criterio_profesional: {
            type: "string",
            minLength: 1,
            maxLength: 1200
          },
          evidencia_usada: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              maxLength: 500
            }
          },
          inferencias: {
            type: "array",
            maxItems: 8,
            items: {
              type: "string",
              maxLength: 500
            }
          },
          riesgos: {
            type: "array",
            maxItems: 8,
            items: {
              type: "string",
              maxLength: 500
            }
          },
          objeciones: {
            type: "array",
            maxItems: 8,
            items: {
              type: "string",
              maxLength: 500
            }
          },
          acuerdos: {
            type: "array",
            maxItems: 8,
            items: {
              type: "string",
              maxLength: 500
            }
          },
          datos_faltantes: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              maxLength: 350
            }
          },
          confianza: {
            type: "integer",
            minimum: 0,
            maximum: 100
          }
        }
      }
    }
  }
});

module.exports = {
  RESPUESTA_EXPERTA_SCHEMA
};
