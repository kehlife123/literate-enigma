'use strict';

const sharp = require('sharp');

/**
 * Sample up to `maxFrames` evenly-spaced frames from an animated GIF (or
 * APNG/animated WEBP) and return each as a standalone PNG buffer, ready to
 * hand to the classifier one at a time.
 *
 * @param {Buffer} buffer Raw animated image bytes.
 * @param {number} maxFrames Upper bound on frames to sample (cost control).
 * @returns {Promise<Buffer[]>}
 */
async function sampleFrames(buffer, maxFrames = 4) {
  const probe = sharp(buffer, { animated: true });
  const meta = await probe.metadata();
  const totalPages = meta.pages && meta.pages > 0 ? meta.pages : 1;
  const sampleCount = Math.max(1, Math.min(maxFrames, totalPages));
  const step = Math.max(1, Math.floor(totalPages / sampleCount));

  const frames = [];
  for (let page = 0; page < totalPages && frames.length < sampleCount; page += step) {
    // Selecting a specific `page` on a multi-page source (GIF/APNG/TIFF)
    // pulls out that single frame as a static image.
    // eslint-disable-next-line no-await-in-loop
    const frameBuffer = await sharp(buffer, { page }).png().toBuffer();
    frames.push(frameBuffer);
  }
  return frames;
}

module.exports = { sampleFrames };
