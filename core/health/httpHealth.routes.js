"use strict";
const {getDeploymentCommit}=require("./deploymentCommit.contract");
function registerHttpHealthRoutes(app,mongoose,{version,commit=process.env.RENDER_GIT_COMMIT,uptime=()=>process.uptime()}={}){
 if(typeof app?.get!=="function"||!mongoose?.connection||typeof version!=="string")
  throw new Error("HEALTH_ROUTE_CONFIG_INVALID");
 app.get("/ready",(_req,res)=>{
  const connected=mongoose.connection.readyState===1;
  res.set("Cache-Control","no-store");
  res.status(connected?200:503).json({
   ready:connected,db:connected?"connected":"disconnected"
  });
 });
 app.get("/health",(_req,res)=>{
  const connected=mongoose.connection.readyState===1;
  res.set("Cache-Control","no-store");
  res.status(connected?200:503).json({
   status:connected?"ok":"degraded",version,
   commit:getDeploymentCommit(commit),db:connected?"connected":"disconnected",
   uptime:Math.floor(uptime())
  });
 });
}
module.exports={registerHttpHealthRoutes};
