'use strict';

// Deliberately using plain `@tensorflow/tfjs` (pure JavaScript, CPU backend)
// instead of `@tensorflow/tfjs-node`. tfjs-node ships a native .node addon
// that, as of writing, has no working prebuilt binary for Windows and fails
// to load even when rebuilt from source (see tensorflow/tfjs#8579). The pure
// JS backend is slower per image but needs zero native compilation, so it
// installs and runs identically on Windows, macOS, Linux, and Railway.
const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');
const sharp = require('sharp');
const logger = require('../utils/logger');

let modelPromise = null;

/** Load the NSFWJS model once and cache the in-flight/completed promise. */
function loadModel() {
  if (!modelPromise) {
    logger.info('classifier', 'Loading NSFW model (first run downloads it, then it is cached)...');
    modelPromise = nsfwjs.load().then((model) => {
      logger.info('classifier', 'NSFW model ready.');
      return model;
    });
  }
  return modelPromise;
}

/**
 * Decode any image buffer (PNG/JPEG/WEBP - sharp handles all of them) into
 * the int32 [height, width, 3] tensor nsfwjs/tfjs expects, without relying
 * on tfjs-node's native decoder.
 */
async function bufferToTensor(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const int32Data = Int32Array.from(data);
  return tf.tensor3d(int32Data, [info.height, info.width, info.channels], 'int32');
}

/**
 * Classify a single still image buffer (PNG/JPEG/WEBP).
 * @param {Buffer} buffer
 * @returns {Promise<{score: number, predictions: Array<{className: string, probability: number}>}>}
 *   score is the combined "unsafe" probability (Porn + Hentai + half of Sexy), 0-1.
 */
async function classifyImageBuffer(buffer) {
  const model = await loadModel();
  const tensor = await bufferToTensor(buffer);
  try {
    const predictions = await model.classify(tensor);
    const byClass = Object.fromEntries(predictions.map((p) => [p.className, p.probability]));
    const porn = byClass.Porn || 0;
    const hentai = byClass.Hentai || 0;
    const sexy = byClass.Sexy || 0;
    const score = Math.min(1, porn + hentai + sexy * 0.5);
    return { score, predictions };
  } finally {
    tensor.dispose();
  }
}

module.exports = { loadModel, classifyImageBuffer };
