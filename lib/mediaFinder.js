'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const TEMP_DIR = path.join(__dirname, '..', 'temp', 'media');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function searchPexelsImages(query) {
  if (!config.PEXELS_API_KEY) return [];
  try {
    const res = await axios.get('https://api.pexels.com/v1/search', {
      headers: { Authorization: config.PEXELS_API_KEY },
      params: { query, per_page: 3, orientation: 'landscape' },
      timeout: 10000,
    });
    return (res.data.photos || []).map(p => ({
      url: p.src.large2x || p.src.large,
      credit: `Photo by ${p.photographer} on Pexels`,
      source: 'pexels',
      type: 'image',
    }));
  } catch (err) {
    console.warn(`[mediaFinder] Pexels image search failed: ${err.message}`);
    return [];
  }
}

async function searchPexelsVideos(query) {
  if (!config.PEXELS_API_KEY) return [];
  try {
    const res = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: config.PEXELS_API_KEY },
      params: { query, per_page: 2, orientation: 'landscape' },
      timeout: 10000,
    });
    return (res.data.videos || []).map(v => {
      const file = v.video_files?.find(f => f.quality === 'hd') || v.video_files?.[0];
      return {
        url: file?.link,
        credit: `Video by ${v.user?.name} on Pexels`,
        source: 'pexels-video',
        type: 'video',
        duration: v.duration,
      };
    }).filter(v => v.url);
  } catch (err) {
    console.warn(`[mediaFinder] Pexels video search failed: ${err.message}`);
    return [];
  }
}

async function searchPixabay(query) {
  if (!config.PIXABAY_API_KEY) return [];
  try {
    const res = await axios.get('https://pixabay.com/api/', {
      params: {
        key: config.PIXABAY_API_KEY,
        q: encodeURIComponent(query),
        image_type: 'photo',
        orientation: 'horizontal',
        category: 'sports',
        per_page: 3,
        safesearch: 'true',
      },
      timeout: 10000,
    });
    return (res.data.hits || []).map(img => ({
      url: img.largeImageURL,
      credit: `Image by ${img.user} on Pixabay`,
      source: 'pixabay',
      type: 'image',
    }));
  } catch (err) {
    console.warn(`[mediaFinder] Pixabay search failed: ${err.message}`);
    return [];
  }
}

async function downloadFile(url, filename) {
  ensureDir(TEMP_DIR);
  const filePath = path.join(TEMP_DIR, filename);
  if (fs.existsSync(filePath)) return filePath;

  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'FIFAContentCreator/1.0' },
  });
  fs.writeFileSync(filePath, res.data);
  return filePath;
}

async function findMediaForScene(scene, index) {
  const query = scene.searchQuery || scene.visualDescription || 'soccer football';

  let results = await searchPexelsImages(query);

  if (!results.length) results = await searchPixabay(query);

  if (!results.length && (query.includes('soccer') || query.includes('football'))) {
    results = await searchPexelsImages('soccer stadium crowd');
  }

  if (!results.length) {
    console.warn(`[mediaFinder] No media for scene ${index} (query: "${query}")`);
    return null;
  }

  const media = results[0];
  const ext = media.type === 'video' ? 'mp4' : 'jpg';
  const filename = `scene_${index}_${Date.now()}.${ext}`;

  try {
    const localPath = await downloadFile(media.url, filename);
    return { ...media, localPath };
  } catch (err) {
    console.warn(`[mediaFinder] Download failed for scene ${index}: ${err.message}`);
    return null;
  }
}

async function findMediaForScenes(scenes) {
  console.log(`[mediaFinder] Sourcing media for ${scenes.length} scenes...`);

  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    results.push(await findMediaForScene(scenes[i], i + 1));
    process.stdout.write(`\r[mediaFinder] ${i + 1}/${scenes.length} scenes processed`);
  }
  console.log('');

  const found = results.filter(Boolean).length;
  console.log(`[mediaFinder] Media found for ${found}/${scenes.length} scenes`);
  return results;
}

module.exports = { findMediaForScenes };
