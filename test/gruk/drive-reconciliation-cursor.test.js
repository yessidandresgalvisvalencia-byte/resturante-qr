'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCoordinator}=require('../../scripts/gruk/drive-reconciliation-coordinator');
const name='gruk-restaurante-1-1.archive.age';
function fixture(){
 let state={cursor:null};let releases=0;
 const db={databaseName:'gruk_storage_catalog',collection(){return {
  async updateOne(q,u,o){state={...state,...u.$set};if(!o.upsert)releases++;return {acknowledged:true,modifiedCount:1,upsertedCount:0};},
  async findOne(q){assert.equal(q.owner,state.owner);return {...state};}
 };}};
 return {db,state:()=>state,releases:()=>releases};
}
test('cursor advances only with successful reservation release and resumes next page',async()=>{
 const f=fixture(),seen=[];
 const run=createCoordinator(f.db,{now:()=>0,discover:async after=>{seen.push(after);return after===null?{names:[name],nextCursor:name}:{names:[],nextCursor:null};}});
 await run(async page=>({status:'COMPLETED',checked:page.names.length,restoreVerified:false}));
 assert.equal(f.state().cursor,name);
 await run(async page=>({status:'COMPLETED',checked:page.names.length,restoreVerified:false}));
 assert.deepEqual(seen,[null,name]);assert.equal(f.state().cursor,null);
});
test('incomplete page does not advance cursor or release reservation',async()=>{
 const f=fixture();
 const run=createCoordinator(f.db,{now:()=>0,discover:async()=>({names:[name],nextCursor:name})});
 await assert.rejects(run(async()=>({status:'COMPLETED',checked:0,restoreVerified:false})),/PAGE_INCOMPLETE/);
 assert.equal(f.state().cursor,null);assert.equal(f.state().active,true);assert.equal(f.releases(),0);
});
