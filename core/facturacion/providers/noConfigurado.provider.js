"use strict";
const FacturacionProvider=require("./provider.interface");
class NoConfiguradoProvider extends FacturacionProvider{async emitir(){const e=new Error("GRUK Facturación: proveedor tecnológico no configurado");e.code="PROVEEDOR_NO_CONFIGURADO";throw e;}}
module.exports=NoConfiguradoProvider;