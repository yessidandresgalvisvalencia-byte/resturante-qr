"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {renovar}=require("../../modules/finanzas-personales/services/gmailTokenRefreshPersonal.service");
test("sin conexión Gmail no se ejecuta solicitud de renovación",async()=>{
 await assert.rejects(()=>renovar("507f1f77bcf86cd799439011"),/connect|buffering|Gmail/i);
});
