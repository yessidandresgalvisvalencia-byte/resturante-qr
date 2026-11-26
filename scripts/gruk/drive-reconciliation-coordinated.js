'use strict';
const {discoverCatalogPage}=require('./drive-catalog-discovery');
const {createAudit}=require('./drive-reconciliation-audit');
const {createCoordinator}=require('./drive-reconciliation-coordinator');
const {createBatchRunner}=require('./drive-reconciliation-batch');
const {runReconciliation}=require('./drive-reconciliation-runtime');
const {validateCatalogConnection}=require('./drive-catalog-connection');
async function runCoordinated({names,env=process.env,connect,fetchImpl=fetch,alert,now=Date.now}){
 if(env.GRUK_CATALOG_ENABLED!=='true'||env.GRUK_RECONCILIATION_ENABLED!=='true'||env.GRUK_COORDINATED_INSPECTION_ENABLED!=='true'||typeof connect!=='function'||typeof alert!=='function')throw Error('COORDINATED_DISABLED');
 const automatic=names===undefined&&env.GRUK_INSPECTION_DISCOVERY_ENABLED==='true';
 if(!automatic&&(!Array.isArray(names)||names.length<1||names.length>10||names.some(n=>typeof n!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(n))))throw Error('BATCH_NAMES');
 const config={catalogUri:env.GRUK_CATALOG_MONGO_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 validateCatalogConnection(config);
 const c=await connect(config.catalogUri,{dbName:'gruk_storage_catalog',tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:2});
 try{
  const coordinate=createCoordinator(c.db,{now,audit:event=>createAudit(c.db)(event),discover:automatic?after=>discoverCatalogPage(c.db,{after}):undefined});
  const batch=createBatchRunner({now,alert,inspect:name=>runReconciliation({name,env,connect,fetchImpl,now,alert:async()=>{}})});
  return await coordinate(page=>page?(page.names.length?batch(page.names):{status:'COMPLETED',checked:0,counts:{},restoreVerified:false}):batch(names));
 }finally{await c.close();}
}
module.exports={runCoordinated};
