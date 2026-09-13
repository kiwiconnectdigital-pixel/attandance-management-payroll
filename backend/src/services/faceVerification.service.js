const path = require("path");
const fs = require("fs");

require("@tensorflow/tfjs-backend-wasm");
const tf = require("@tensorflow/tfjs");

const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");

const { Canvas, Image, ImageData, createCanvas, loadImage } = require("canvas");

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, "../models/face-api-weights");
const MATCH_THRESHOLD = 0.5;

const MAX_DETECTION_DIMENSION = 480;
let modelsLoaded = false;

const loadModels = async () => {
  if (modelsLoaded) return;

  await tf.setBackend("wasm");
  await tf.ready();

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH),
    faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
    faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
  ]);

  modelsLoaded = true;
};

const getFaceDescriptor = async (imagePath) => {
  await loadModels();

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const img = await loadImage(imagePath);

  const scale = Math.min(
    1,
    MAX_DETECTION_DIMENSION / Math.max(img.width, img.height),
  );
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = createCanvas(targetWidth, targetHeight);
  canvas.getContext("2d").drawImage(img, 0, 0, targetWidth, targetHeight);

  const detection = await faceapi
    .detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? detection.descriptor : null;
};

const compareDescriptors = (d1, d2) => {
  const a = d1 instanceof Float32Array ? d1 : new Float32Array(d1);
  const b = d2 instanceof Float32Array ? d2 : new Float32Array(d2);
  return faceapi.euclideanDistance(a, b);
};

const warmUp = async () => {
  try {
    await loadModels();
    console.log("[FaceAPI] Warm-up complete");
  } catch (err) {
    console.error("[FaceAPI] Warm-up failed:", err.message);
  }
};

module.exports = {
  getFaceDescriptor,
  compareDescriptors,
  MATCH_THRESHOLD,
  warmUp,
};
