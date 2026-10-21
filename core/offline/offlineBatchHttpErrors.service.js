"use strict";
const RETRYABLE = new Set(["OFFLINE_TRANSACTION_UNAVAILABLE","OFFLINE_INBOX_WRITE_UNVERIFIED"]);
function isRetryableOfflineBatchError(error){
 return typeof error?.code==="string" && RETRYABLE.has(error.code);
}
module.exports={isRetryableOfflineBatchError};
