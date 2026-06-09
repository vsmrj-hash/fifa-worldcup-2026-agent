#!/usr/bin/env node
'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getOAuth2Client, saveToken, SCOPES } = require('./lib/youtubeUploader');

async function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n🏆 FIFA Content Creator — YouTube Authorization Setup\n');

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    console.error('❌ YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET is missing from .env\n');
    console.error('Steps to get them:');
    console.error('  1. Go to https://console.cloud.google.com/');
    console.error('  2. Create a project (or select existing)');
    console.error('  3. Enable "YouTube Data API v3"');
    console.error('  4. APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID');
    console.error('  5. Application type: Desktop app');
    console.error('  6. Copy the Client ID and Client Secret into .env\n');
    process.exit(1);
  }

  const oauth2 = getOAuth2Client();
  const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

  console.log('Open this URL in your browser to authorize the app:\n');
  console.log(authUrl);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await prompt(rl, 'Paste the authorization code here: ');
  rl.close();

  const { tokens } = await oauth2.getToken(code.trim());
  saveToken(tokens);

  console.log('\n✅ Authorization complete!');
  console.log('   Token saved to data/youtube-token.json');
  console.log('\n   Run the pipeline now:');
  console.log('   node index.js\n');
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
