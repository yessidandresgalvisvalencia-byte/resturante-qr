'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAlertSink}=require('../../scripts/gruk/native-storage-alerts');
test('alerts expose only allowed fields and report delivery errors',async()=>{
 const lines=[];
 const alert=createAlertSink({write:(line,cb)=>{lines.push(line);cb();}});
 await alert({code:'LOW_CAPACITY',at:123,secret:'private'});
 await alert({code:'BACKUP_FAILED',at:124});
 assert.deepEqual(JSON.parse(lines[0]),{service:'gruk-storage',severity:'error',code:'LOW_CAPACITY',at:123});
 assert.equal(JSON.parse(lines[1]).code,'BACKUP_FAILED');
 await assert.rejects(alert({code:'UNKNOWN',at:123}),/INVALID_ALERT/);
 await assert.rejects(alert({code:'BACKUP_FAILED',at:-1}),/INVALID_ALERT/);
 assert.equal(lines.length,2);
 const broken=createAlertSink({write:(_line,cb)=>cb(Error('private'))});
 await assert.rejects(broken({code:'BACKUP_FAILED',at:123}),/ALERT_DELIVERY_FAILED/);
});

require('node:test').test('alert delivery fails safely when sink stalls or throws',async()=>{
 const {createAlertSink}=require('../../scripts/gruk/native-storage-alerts');
 const event={code:'BACKUP_FAILED',at:123};
 for(const write of [()=>{},()=>{throw Error('private sink error');}]){
  await require('node:assert/strict').rejects(createAlertSink({write,timeoutMs:20})(event),{message:'ALERT_DELIVERY_FAILED'});
 }
});
