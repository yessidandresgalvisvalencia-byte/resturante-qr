'use strict';
function bytes(value){
 if(typeof value!=='string'||!/^\d{1,20}$/.test(value))throw Error('DRIVE_QUOTA_UNVERIFIED');
 return BigInt(value);
}
function assertUploadQuota(quota,size,{reserve=104857600n,maxArchive=1073741824n}={}){
 if(!Number.isSafeInteger(size)||size<64||typeof reserve!=='bigint'||reserve<0n||typeof maxArchive!=='bigint'||maxArchive<64n)throw Error('DRIVE_QUOTA_POLICY_INVALID');
 const limit=bytes(quota?.limit),usage=bytes(quota?.usage);
 if(limit<=0n||usage>limit)throw Error('DRIVE_QUOTA_UNVERIFIED');
 if(BigInt(size)>maxArchive)throw Error('DRIVE_ARCHIVE_LIMIT');
 if(limit-usage<BigInt(size)+reserve)throw Error('DRIVE_QUOTA_INSUFFICIENT');
}
module.exports={assertUploadQuota};
