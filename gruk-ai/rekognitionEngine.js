const {
  RekognitionClient,
  CompareFacesCommand
} = require("@aws-sdk/client-rekognition");

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

function base64ToBytes(base64) {
  const limpio = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(limpio, "base64");
}

async function compararCarasGRUK(fotoBase, selfie) {
  const command = new CompareFacesCommand({
    SourceImage: {
      Bytes: base64ToBytes(fotoBase)
    },
    TargetImage: {
      Bytes: base64ToBytes(selfie)
    },
    SimilarityThreshold: 90,
    QualityFilter: "AUTO"
  });

  const result = await rekognition.send(command);

  const mejor = result.FaceMatches?.[0];

  if (!mejor) {
    return {
      coincide: false,
      similitud: 0
    };
  }

  return {
    coincide: true,
    similitud: mejor.Similarity || 0
  };
}

module.exports = {
  compararCarasGRUK
};