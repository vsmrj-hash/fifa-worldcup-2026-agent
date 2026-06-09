#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const config = require('./config');
const { scrapeNews } = require('./lib/newsScraper');
const { generateScript } = require('./lib/scriptWriter');
const { findMediaForScenes } = require('./lib/mediaFinder');
const { generateImage } = require('./lib/imageGenerator');
const { generateNarration } = require('./lib/ttsNarrator');
const { buildVideo } = require('./lib/videoBuilder');
const { uploadVideo } = require('./lib/youtubeUploader');

const DATA_DIR = path.join(__dirname, 'data');
const LOG_DIR = path.join(__dirname, 'logs');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureDirs() {
  [DATA_DIR, LOG_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function appendHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 200), null, 2));
}

function logError(err) {
  ensureDirs();
  const entry = `[${new Date().toISOString()}] ${err.message}\n${err.stack}\n\n`;
  fs.appendFileSync(path.join(LOG_DIR, 'errors.log'), entry);
}

async function runPipeline(options = {}) {
  ensureDirs();
  config.validateRequired();

  const t0 = Date.now();
  console.log('\n' + '='.repeat(62));
  console.log('ð  FIFA Content Creator  |  ' + new Date().toUTCString());
  console.log('='.repeat(62) + '\n');

  try {
    // ââ 1. News âââââââââââââââââââââââââââââââââââââââââââââââââ
    console.log('ð°  Step 1/6: Scraping FIFA news...');
    const articles = await scrapeNews(5);
    if (!articles.length) throw new Error('No articles found. Check network / RSS sources.');
    console.log(`   Top story: "${articles[0].title}" [${articles[0].source}]\n`);

    // ââ 2. Script ââââââââââââââââââââââââââââââââââââââââââââââââ
    console.log('âï¸   Step 2/6: Writing video script with Claude...');
    const script = await generateScript(articles, options.format || config.VIDEO_FORMAT);
    console.log(`   Title   : ${script.title}`);
    console.log(`   Format  : ${script.format} | ${script.scenes.length} scenes | ${script.totalDuration}s\n`);

    // ââ 3. Media âââââââââââââââââââââââââââââââââââââââââââââââââ
    console.log('ð¼ï¸   Step 3/6: Sourcing royalty-free media...');
    let mediaFiles = await findMediaForScenes(script.scenes);

    let aiGenCount = 0;
    for (let i = 0; i < mediaFiles.length; i++) {
      if (!mediaFiles[i]) {
        const gen = await generateImage(script.scenes[i].visualDescription);
        if (gen) { mediaFiles[i] = gen; aiGenCount++; }
      }
    }

    const validCount = mediaFiles.filter(Boolean).length;
    if (!validCount) throw new Error('No media obtained. Add PEXELS_API_KEY or STABILITY_API_KEY.');
    console.log(`   ${validCount}/${script.scenes.length} scenes covered (${aiGenCount} AI-generated)\n`);

    // ââ 4. Narration âââââââââââââââââââââââââââââââââââââââââââââ
    let audioPath = null;
    if (config.ELEVENLABS_API_KEY || config.OPENAI_API_KEY) {
      console.log('ðï¸   Step 4/6: Generating AI voice narration...');
      audioPath = await generateNarration(script.scenes);
      console.log(audioPath ? `   Audio: ${path.basename(audioPath)}\n` : '   Narration skipped (TTS failed)\n');
    } else {
      console.log('ðï¸   Step 4/6: Skipping narration (no TTS key configured)\n');
    }

    // ââ 5. Build video âââââââââââââââââââââââââââââââââââââââââââ
    console.log('ð¬  Step 5/6: Building video with FFmpeg...');
    const { videoPath, thumbnailPath } = await buildVideo(script, mediaFiles, audioPath);
    console.log(`   Output: ${path.relative(process.cwd(), videoPath)}\n`);

    // ââ 6. Upload ââââââââââââââââââââââââââââââââââââââââââââââââ
    let uploadResult = null;
    if (options.skipUpload) {
      console.log('ð¤  Step 6/6: Upload skipped (--skip-upload)\n');
    } else {
      console.log('ð¤  Step 6/6: Uploading to YouTube...');
      uploadResult = await uploadVideo(videoPath, thumbnailPath, script);
      console.log('');
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const entry = {
      timestamp: new Date().toISOString(),
      title: script.title,
      format: script.format,
      scenes: script.scenes.length,
      durationSec: script.totalDuration,
      videoPath,
      thumbnailPath,
      youtubeUrl: uploadResult?.videoUrl || null,
      elapsedSec: elapsed,
    };
    appendHistory(entry);

    console.log('='.repeat(62));
    if (uploadResult?.videoUrl) {
      console.log('â  DONE â Published to YouTube:');
      console.log('    ' + uploadResult.videoUrl);
    } else {
      console.log('â  DONE â Video saved locally:');
      console.log('    ' + videoPath);
    }
    console.log(`â±ï¸   Pipeline took ${elapsed}s`);
    console.log('='.repeat(62) + '\n');

    return entry;

  } catch (err) {
    logError(err);
    console.error('\nâ  Pipeline failed:', err.message);
    console.error('    See logs/errors.log for the full trace\n');
    throw err;
  }
}

// ââ CLI ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipUpload: args.includes('--skip-upload'),
    format: args.find(a => a.startsWith('--format='))?.split('=')[1],
  };
  runPipeline(options).catch(() => process.exit(1));
}

module.exports = { runPipeline };
