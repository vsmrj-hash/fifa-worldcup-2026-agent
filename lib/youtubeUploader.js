'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOKEN_PATH = path.join(DATA_DIR, 'youtube-token.json');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.YOUTUBE_CLIENT_ID,
    config.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
}

function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

function saveToken(token) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function getAuthClient() {
  const token = loadToken();
  if (!token) {
    throw new Error('No YouTube token found. Run: node scripts/fifa/setup.js');
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(token);

  if (token.expiry_date && Date.now() >= token.expiry_date - 60_000) {
    const { credentials } = await oauth2.refreshAccessToken();
    saveToken(credentials);
    oauth2.setCredentials(credentials);
  }

  return oauth2;
}

async function uploadVideo(videoPath, thumbnailPath, script) {
  if (!config.YOUTUBE_CLIENT_ID || !config.YOUTUBE_CLIENT_SECRET) {
    throw new Error('YouTube credentials not set. See scripts/fifa/.env.example');
  }

  console.log('[youtubeUploader] Authenticating...');
  const auth = await getAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const fileSize = fs.statSync(videoPath).size;
  console.log(`[youtubeUploader] Uploading ${(fileSize / 1_048_576).toFixed(1)} MB...`);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: script.title,
        description: script.description || '',
        tags: script.tags || ['FIFA', 'World Cup 2026', 'soccer', 'football'],
        categoryId: '17',
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: config.YOUTUBE_PRIVACY || 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  const videoId = res.data.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(thumbnailPath),
        },
      });
      console.log('[youtubeUploader] Custom thumbnail uploaded');
    } catch (err) {
      console.warn('[youtubeUploader] Thumbnail upload failed:', err.message);
    }
  }

  console.log('[youtubeUploader] Published:', videoUrl);
  return { videoId, videoUrl };
}

module.exports = { uploadVideo, getOAuth2Client, saveToken, SCOPES };
