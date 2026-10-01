"use strict";
function returns(prices){const r=[];for(let i=1;i<prices.length;i++){const a=prices[i-1],b=prices[i];if(!(a>0&&b>0))throw new Error("Serie de precios inválida");r.push(b/a-1)}return r}
function mean(a){return a.reduce((s,x)=>s+x,0)/a.length}
function std(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))}
function maxDrawdown(prices){let peak=prices[0],worst=0;for(const p of prices){peak=Math.max(peak,p);worst=Math.max(worst,(peak-p)/peak)}return worst*100}
function annualize(prices,periods=252){if(!Array.isArray(prices)||prices.length<60)throw new Error("Serie insuficiente: mínimo 60 observaciones");const r=returns(prices),m=mean(r),v=std(r);return{retornoEsperadoAnualPct:Number((((1+m)**periods-1)*100).toFixed(4)),volatilidadAnualPct:Number((v*Math.sqrt(periods)*100).toFixed(4)),maxDrawdownHistoricoPct:Number(maxDrawdown(prices).toFixed(4)),observaciones:prices.length}}
module.exports={annualize,maxDrawdown,returns};