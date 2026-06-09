'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const TEMP_DIR = path.join(__dirname, '..', 'temp', 'media');

async function generateWithStabilityAI(visualDescription) {
  if (!config.STABILITY_API_KEY) return null;

  const prompt = `Professional sports photography, ${visualDescription}, FIFA World Cup 2026, stadium lights, dramatic, high quality, 4K`;

  try {
    const res = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [
          { text: prompt, weight: 1 },
          { text: 'blurry, low quality, watermark, logo, text overlay', weight: -1 },
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1792,
        samples: 1,
        steps: 30,
      },
      {
        headers: {
          Authorization: `Bearer ${config.STABILITY_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 90000,
      }
    );

    const imageData = res.data.artifacts?.[0]?.base64;
    if (!imageData) return null;

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const filename = `generated_${Date.now()}.png`;
    const filePath = path.join(TEMP_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));

    return { localPath: filePath, credit: 'AI-generated via Stability AI', source: 'stability-ai', type: 'image' };
  } catch (err) {
    console.warn(`[imageGenerator] Stability AI failed: ${err.message}`);
    return null;
  }
}

async function generateImage(visualDescription) {
  return generateWithStabilityAI(visualDescription);
}

module.exports = { generateImage };
