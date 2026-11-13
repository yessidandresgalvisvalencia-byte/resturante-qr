"use strict";
class Nodo{constructor(tag="div"){this.tagName=tag;this.value="";this.hidden=false;this.disabled=false;this.children=[];this.handlers={};this._text="";}set textContent(t){this._text=String(t);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join("");}append(...ns){this.children.push(...ns);}replaceChildren(...ns){this.children=ns;this._text="";}addEventListener(k,f){this.handlers[k]=f;}async click(){if(!this.disabled)return this.handlers.click?.();}input(v){this.value=v;return this.handlers.input?.();}}
function documento(){const nodes=new Map();return{getElementById(id){if(!nodes.has(id))nodes.set(id,new Nodo());return nodes.get(id);},createElement:tag=>new Nodo(tag)};}
module.exports={Nodo,documento};
