'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const AUDIO_DIR = path.join(__dirname, '..', 'temp', 'audio');

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function generateNarration(scenes) {
  if (!config.OPENAI_API_KEY) {
    console.log('[ttsNarrator] OPENAI_API_KEY not set â video will use text overlays only');
    return null;
  }

  const fullScript = scenes.map(s => s.text).join(' ');
  console.log(`[ttsNarrator] Generating narration via OpenAI TTS (${fullScript.length} chars)...`);

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      { model: 'tts-1-hd', input: fullScript, voice: 'onyx', speed: 1.05 },
      {
        headers: {
          Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 120000,
      }
    );

    ensureDir();
    const filePath = path.join(AUDIO_DIR, `narration_${Date.now()}.mp3`);
    fs.writeFileSync(filePath, res.data);
    console.log('[ttsNarrator] Narration saved:', path.basename(filePath));
    return filePath;
  } catch (err) {
    console.warn(`[ttsNarrator] OpenAI TTS failed: ${err.message}`);
    return null;
  }
}

module.exports = { generateNarration };
