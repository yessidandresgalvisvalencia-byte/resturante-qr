'use strict';
const {createMongoCatalogStore}=require('./drive-catalog-mongo-store');
function parseEndpoint(uri){
 if(typeof uri!=='string'||uri.length>8192)throw Error('CATALOG_ENDPOINT_INVALID');
 let u;try{u=new URL(uri);}catch{throw Error('CATALOG_ENDPOINT_INVALID');}
 if(u.protocol!=='mongodb+srv:'||!u.hostname.endsWith('.mongodb.net')||u.port||!u.username||!u.password||u.hash)throw Error('CATALOG_ENDPOINT_INVALID');
 for(const [key,value] of u.searchParams){
  if(!['retrywrites','w','appname','authsource','tls'].includes(key.toLowerCase())||(key.toLowerCase()==='tls'&&value!=='true'))throw Error('CATALOG_ENDPOINT_OPTIONS');
 }
 return u;
}
function validateCatalogConnection({catalogUri,sourceUri,expectedHost}){
 const catalog=parseEndpoint(catalogUri),source=parseEndpoint(sourceUri);
 if(typeof expectedHost!=='string'||catalog.hostname!==expectedHost||catalog.pathname!=='/gruk_storage_catalog')throw Error('CATALOG_ENDPOINT_SCOPE');
 if(catalog.hostname===source.hostname||catalog.username===source.username)throw Error('CATALOG_ENDPOINT_NOT_SEPARATE');
 return true;
}
async function withCatalogStore(config,operation,{connect}={}){
 validateCatalogConnection(config);
 if(typeof operation!=='function'||typeof connect!=='function')throw Error('CATALOG_CONNECTION_CONFIG');
 const connection=await connect(config.catalogUri,{dbName:'gruk_storage_catalog',tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:2});
 try{return await operation(createMongoCatalogStore(connection.db));}
 finally{await connection.close();}
}
module.exports={validateCatalogConnection,withCatalogStore};
