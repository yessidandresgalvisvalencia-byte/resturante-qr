const mongoose = require("mongoose");

const inventarioSchema = new mongoose.Schema({

restaurantId:{
type:String,
required:true
},

nombre:{
type:String,
required:true
},

categoria:{
type:String,
required:true
},

cantidad:{
type:Number,
required:true
},

unidad:{
type:String,
default:"unidades"
},

fechaCompra:{
type:Date
},

fechaVencimiento:{
type:Date,
required:true
},

proveedor:{
type:String,
default:""
},

estado:{
type:String,
default:"vigente"
},

prioridad:{
type:String,
default:"media"
},

createdAt:{
type:Date,
default:Date.now
}

});

module.exports =
mongoose.model(
"Inventario",
inventarioSchema
);