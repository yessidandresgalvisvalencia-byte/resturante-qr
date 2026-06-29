module.exports = {

    faceService:

        process.env.FACE_SERVICE_URL ||

        "http://localhost:5050",

    distanciaMaxima:0.40,

    modelo:"Facenet",

    version:"1.0.0"

};