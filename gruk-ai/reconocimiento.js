const axios=require("axios");

const config=require("./config");

async function reconocerEmpleado({

    restaurantId,

    selfie,

    empleados

}){

    try{

        const respuesta=

        await axios.post(

            `${config.faceService}/reconocer`,

            {

                restaurantId,

                selfie,

                empleados

            }

        );

        return respuesta.data;

    }

    catch(error){

        return{

            ok:false,

            mensaje:

            "No fue posible reconocer el empleado.",

            error:error.message

        };

    }

}

module.exports={

    reconocerEmpleado

};