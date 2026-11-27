"use strict";
const mongoose=require("mongoose");
const {provisionarMongoPersonal}=require("../modules/finanzas-personales/security/provisionMongoPersonal.service");
async function main(args=process.argv.slice(2)){
 if(args.length!==1||args[0]!=="--apply")throw new Error("Usa --apply para la provisión administrativa explícita");
 if(!process.env.PERSONAL_MONGO_PROVISION_URI)throw new Error("PERSONAL_MONGO_PROVISION_URI requerida; no se reutiliza la conexión de aplicación");
 const base=process.env.PERSONAL_MONGO_DB;
 if(typeof base!=="string"||!base.trim()||["admin","local","config"].includes(base))throw new Error("PERSONAL_MONGO_DB explícita y no administrativa requerida");
 await mongoose.connect(process.env.PERSONAL_MONGO_PROVISION_URI,{
  autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:10000,
  dbName:base
 });
 try{return await provisionarMongoPersonal(mongoose.connection.db);}finally{await mongoose.disconnect();}
}
if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{
 console.error("Provisión personal no completada:",Number.isInteger(e.code)?e.code:"CONFIGURACION_O_PROVISION_INVALIDA");process.exitCode=1;
});
module.exports={main};
