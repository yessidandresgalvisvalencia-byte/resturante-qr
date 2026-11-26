'use strict';
// Retired external inspection entrypoint. Native coordination is the supported path.
async function runReconciliation(){throw Error('EXTERNAL_INSPECTION_RETIRED');}
if(require.main===module){console.error('EXTERNAL_INSPECTION_RETIRED');process.exitCode=1;}
module.exports={runReconciliation};
