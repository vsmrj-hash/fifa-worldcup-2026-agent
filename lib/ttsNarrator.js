'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const AUDIO_DIR = path.join(__dirname, '..', 'temp', 'audio');

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function generateWithElevenLabs(text) {
  if (!config.ELEVENLABS_API_KEY) return null;

  // "Rachel" voice â energetic, clear sports commentary style
  const voiceId = '21m00Tcm4TlvDq8ikWAM';

  try {
    const res = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3 },
      },
      {
        headers: {
          'xi-api-key': config.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 120000,
      }
    );

    ensureDir();
    const filePath = path.join(AUDIO_DIR, `narration_${Date.now()}.mp3`);
    fs.writeFileSync(filePath, res.data);
    return filePath;
  } catch (err) {
    console.warn(`[ttsNarrator] ElevenLabs failed: ${err.message}`);
    return null;
  }
}

async function generateWithOpenAI(text) {
  if (!config.OPENAI_API_KEY) return null;

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      { model: 'tts-1-hd', input: text, voice: 'onyx', speed: 1.05 },
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
    return filePath;
  } catch (err) {
    console.warn(`[ttsNarrator] OpenAI TTS failed: ${err.message}`);
    return null;
  }
}

async function generateNarration(scenes) {
  if (!config.ELEVENLABS_API_KEY && !config.OPENAI_API_KEY) {
    console.log('[ttsNarrator] No TTS key configured â video will use text overlays only');
    return null;
  }

  const fullScript = scenes.map(s => s.text).join(' ');
  console.log(`[ttsNarrator] Generating narration (${fullScript.length} chars)...`);

  const audioPath = await generateWithElevenLabs(fullScript) || await generateWithOpenAI(fullScript);

  if (audioPath) {
    console.log('[ttsNarrator] Narration saved:', path.basename(audioPath));
  }
  return audioPath;
}

module.exports = { generateNarration };
