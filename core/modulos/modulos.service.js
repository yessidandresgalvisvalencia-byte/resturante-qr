"use strict";
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
const Cliente=require("../../models/Cliente");
async function evaluarModulosAutomaticos(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId))throw new Error("MODULOS_EMPRESA_ID_INVALIDO");
 const empresa=await Empresa.findById(empresaId);if(!empresa)throw new Error("MODULOS_EMPRESA_NO_ENCONTRADA");
 const empleados=empresa.configuracion?.empleados_actuales==null?null:Number(empresa.configuracion.empleados_actuales);
 const recurrentes=await Cliente.countDocuments({empresaId:empresa._id,deletedAt:null,numeroCompras:{$gte:2}});
 const gente=empleados!=null&&empleados>15;
 const servicioCliente=recurrentes>100;
 let cambio=false;
 if(empresa.modulos.gente!==gente){empresa.modulos.gente=gente;cambio=true;}
 if(empresa.modulos.servicio_cliente!==servicioCliente){empresa.modulos.servicio_cliente=servicioCliente;cambio=true;}
 if(cambio)await empresa.save();
 return {gente,servicio_cliente:servicioCliente,empleados_actuales:empleados,clientes_recurrentes:recurrentes};
}
module.exports={evaluarModulosAutomaticos};
