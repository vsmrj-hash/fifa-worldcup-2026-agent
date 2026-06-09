'use strict';

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-opus-4-8',

  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
  YOUTUBE_PRIVACY: process.env.YOUTUBE_PRIVACY || 'public',

  PEXELS_API_KEY: process.env.PEXELS_API_KEY,
  PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,

  STABILITY_API_KEY: process.env.STABILITY_API_KEY,
  NEWS_API_KEY: process.env.NEWS_API_KEY,

  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  SCHEDULE_CRON: process.env.SCHEDULE_CRON || '0 12 * * *',
  VIDEO_FORMAT: process.env.VIDEO_FORMAT || 'auto',
};

function validateRequired() {
  const errors = [];

  if (!config.ANTHROPIC_API_KEY) errors.push('ANTHROPIC_API_KEY');
  if (!config.YOUTUBE_CLIENT_ID || !config.YOUTUBE_CLIENT_SECRET) {
    errors.push('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET');
  }
  if (!config.PEXELS_API_KEY && !config.PIXABAY_API_KEY && !config.STABILITY_API_KEY) {
    errors.push('at least one of: PEXELS_API_KEY, PIXABAY_API_KEY, STABILITY_API_KEY');
  }

  if (errors.length) {
    console.error('\n[config] Missing required environment variables:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nCopy .env.example to .env and fill in your keys.');
    console.error('Then run: node setup.js  (one-time YouTube auth)\n');
    process.exit(1);
  }
}

module.exports = { ...config, validateRequired };
