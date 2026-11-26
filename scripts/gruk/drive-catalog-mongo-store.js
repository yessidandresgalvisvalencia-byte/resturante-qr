'use strict';
// A separately provisioned MongoDB deployment can store receipts independently
// of Drive. Never connect using the application or personal database credentials.
const DATABASE='gruk_storage_catalog',COLLECTION='signed_receipts';
function createMongoCatalogStore(db){
 if(db?.databaseName!==DATABASE||typeof db.collection!=='function')throw Error('CATALOG_DATABASE_SCOPE');
 const collection=db.collection(COLLECTION);
 function check(name){
  if(typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name))throw Error('CATALOG_NAME');
 }
 return Object.freeze({
  async putIfAbsent(name,value){
   check(name);
   if(typeof value!=='string'||Buffer.byteLength(value)>4096||!value.length)throw Error('CATALOG_INVALID');
   try{
    const result=await collection.insertOne({_id:name,value},{writeConcern:{w:'majority',j:true,wtimeoutMS:10000}});
    if(result.acknowledged!==true||result.insertedId!==name)throw Error('CATALOG_WRITE_UNVERIFIED');
    return true;
   }catch(error){if(error?.code===11000)return false;throw error;}
  },
  async get(name){
   check(name);
   const item=await collection.findOne({_id:name},{projection:{_id:1,value:1},readConcern:{level:'majority'},readPreference:'primary',maxTimeMS:10000});
   if(item===null)return null;
   if(item._id!==name||typeof item.value!=='string'||Buffer.byteLength(item.value)>4096)throw Error('CATALOG_INVALID');
   return item.value;
  }
 });
}
module.exports={createMongoCatalogStore};
