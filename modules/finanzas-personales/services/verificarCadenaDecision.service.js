"use strict";

/**
 * Auditoría determinística de la cadena DecisionProof v2.
 * El llamador debe pasar TODAS las pruebas del usuario ordenadas por secuencia,
 * sin filtros, y el documento ChainHead del mismo usuario.
 * Esta función no consulta ni modifica la base de datos.
 */
const { verificar } = require("./decisionProof.service");

function fallo(codigo, secuencia = null) {
  return { valida: false, codigo, secuencia };
}

function verificarCadena(registros, head, usuarioEsperado = null) {
  if (!Array.isArray(registros)) throw new TypeError("registros debe ser un arreglo");
  if (!head || !Number.isSafeInteger(head.secuencia) || head.secuencia < 0) {
    return fallo("HEAD_INVALIDO");
  }
  if (usuarioEsperado !== null) {
    const esperado = String(usuarioEsperado);
    if (!/^[a-f0-9]{24}$/.test(esperado)) throw new TypeError("usuarioEsperado inválido");
    if (String(head.usuarioId ?? "") !== esperado) return fallo("PROPIETARIO_HEAD_NO_COINCIDE");
    for (const registro of registros) {
      if (String(registro?.usuarioId ?? "") !== esperado) return fallo("PROPIETARIO_REGISTRO_NO_COINCIDE", registro?.secuencia ?? null);
    }
  }
  if (head.secuencia === 0 && head.headHash !== null) return fallo("HEAD_INVALIDO");
  if (head.secuencia > 0 && !/^[a-f0-9]{64}$/.test(head.headHash || "")) {
    return fallo("HEAD_INVALIDO");
  }

  let hashAnterior = null;
  for (let i = 0; i < registros.length; i += 1) {
    const registro = registros[i];
    const secuenciaEsperada = i + 1;
    if (!registro || registro.version !== 2 || registro.secuencia !== secuenciaEsperada) {
      return fallo("SECUENCIA_INVALIDA", secuenciaEsperada);
    }
    if (registro.previousHash !== hashAnterior) {
      return fallo("ENLACE_ROTO", secuenciaEsperada);
    }
    if (!verificar(registro)) {
      return fallo("HASH_INVALIDO", secuenciaEsperada);
    }
    hashAnterior = registro.hash;
  }

  if (head.secuencia !== registros.length || head.headHash !== hashAnterior) {
    return fallo("HEAD_NO_COINCIDE", registros.length);
  }
  return { valida: true, codigo: "OK", secuencia: registros.length };
}

module.exports = { verificarCadena };
