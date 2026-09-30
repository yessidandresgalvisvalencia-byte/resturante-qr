"use strict";
const axios=require("axios");const FacturacionProvider=require("./provider.interface");
class FactusProvider extends FacturacionProvider{
 constructor(){super();this.base=(process.env.FACTUS_BASE_URL||"").replace(/\/$/,"");}
 configurado(){return process.env.FACTUS_ENABLED==="true"&&this.base&&process.env.FACTUS_CLIENT_ID&&process.env.FACTUS_CLIENT_SECRET&&process.env.FACTUS_USERNAME&&process.env.FACTUS_PASSWORD;}
 async token(){if(!this.configurado()){const e=new Error("Factus no está configurado para emisión real");e.code="PROVEEDOR_NO_CONFIGURADO";throw e;}const {data}=await axios.post(this.base+"/oauth/token",{grant_type:"password",client_id:process.env.FACTUS_CLIENT_ID,client_secret:process.env.FACTUS_CLIENT_SECRET,username:process.env.FACTUS_USERNAME,password:process.env.FACTUS_PASSWORD},{timeout:15000});if(!data?.access_token)throw new Error("Factus no devolvió access_token");return data.access_token;}
 async emitir(snapshot){const token=await this.token(),f=snapshot.fiscal||{},v=snapshot.venta||{};if(!f.numbering_range_id)throw new Error("Falta numbering_range_id de Factus");if(!f.customer?.identification||!f.customer?.names)throw new Error("Faltan datos fiscales del adquirente");if(!Array.isArray(f.items)||!f.items.length)throw new Error("Factura sin ítems fiscales");
 const body={numbering_range_id:f.numbering_range_id,reference_code:"GRUK-"+v.id,observation:"Factura generada desde GRUK",payment_method_code:f.payment_method_code||"10",customer:f.customer,items:f.items};
 const {data}=await axios.post(this.base+"/v2/bills/validate",body,{headers:{Authorization:"Bearer "+token,Accept:"application/json","Content-Type":"application/json"},timeout:30000});
 const d=data?.data||data;return{id:d?.id||d?.bill?.id||null,numero:d?.number||d?.bill?.number||null,cufe:d?.cufe||d?.bill?.cufe||null,raw:data};
 }}
module.exports=FactusProvider;