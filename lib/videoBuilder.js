'use strict';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegStatic);

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const SEGMENTS_DIR = path.join(__dirname, '..', 'temp', 'segments');

function ensureDirs() {
  [OUTPUT_DIR, SEGMENTS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, 'â')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, ' ');
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + word).length > maxChars && line) {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line += word + ' ';
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 3).join('\n');
}

function buildSegment(imagePath, text, duration, outputPath, isVertical) {
  const w = isVertical ? 1080 : 1920;
  const h = isVertical ? 1920 : 1080;
  const fontSize = isVertical ? 42 : 38;
  const maxChars = isVertical ? 28 : 52;
  const wrapped = escapeText(wrapText(text, maxChars));
  const boxH = 210;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .duration(duration)
      .videoFilters([
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
        `drawbox=x=0:y=${h - boxH}:w=${w}:h=${boxH}:color=black@0.72:t=fill`,
        `drawtext=text='${wrapped}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${h - boxH + 20}:line_spacing=10:shadowx=2:shadowy=2`,
      ])
      .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-an', '-preset fast'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function buildThumbnail(imagePath, title, outputPath) {
  const escaped = escapeText(title.slice(0, 55));
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .videoFilters([
        'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black',
        'drawbox=x=0:y=555:w=1280:h=165:color=black@0.82:t=fill',
        `drawtext=text='${escaped}':fontsize=44:fontcolor=yellow:x=(w-text_w)/2:y=575:shadowx=3:shadowy=3`,
      ])
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function concatenateSegments(segmentPaths, audioPath, outputPath) {
  const concatFile = path.join(SEGMENTS_DIR, `concat_${Date.now()}.txt`);
  fs.writeFileSync(concatFile, segmentPaths.map(p => `file '${p}'`).join('\n'));

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0']);

    if (audioPath) {
      cmd = cmd.input(audioPath);
    }

    cmd
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-crf 22',
        '-preset medium',
        ...(audioPath ? ['-c:a aac', '-b:a 128k', '-shortest'] : []),
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function buildVideo(script, mediaFiles, audioPath = null) {
  ensureDirs();

  const isVertical = script.format === 'short';
  const ts = Date.now();
  const segmentPaths = [];

  console.log(`[videoBuilder] Assembling ${script.scenes.length} scenes (${isVertical ? '9:16 Shorts' : '16:9 landscape'})...`);

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const media = mediaFiles[i];

    if (!media?.localPath || !fs.existsSync(media.localPath)) {
      console.warn(`[videoBuilder] Scene ${i + 1}: no media, skipping`);
      continue;
    }

    const segPath = path.join(SEGMENTS_DIR, `seg_${ts}_${i}.mp4`);
    try {
      await buildSegment(media.localPath, scene.text, scene.duration || 8, segPath, isVertical);
      segmentPaths.push(segPath);
      process.stdout.write(`\r[videoBuilder] Rendered ${segmentPaths.length}/${script.scenes.length} segments`);
    } catch (err) {
      console.warn(`\n[videoBuilder] Segment ${i + 1} failed: ${err.message}`);
    }
  }
  console.log('');

  if (!segmentPaths.length) throw new Error('[videoBuilder] No segments rendered â check media files');

  const videoPath = path.join(OUTPUT_DIR, `fifa_${ts}.mp4`);
  console.log('[videoBuilder] Concatenating segments...');
  await concatenateSegments(segmentPaths, audioPath, videoPath);

  const firstMedia = mediaFiles.find(m => m?.localPath && fs.existsSync(m.localPath));
  let thumbnailPath = null;
  if (firstMedia) {
    thumbnailPath = path.join(OUTPUT_DIR, `thumb_${ts}.jpg`);
    try {
      await buildThumbnail(firstMedia.localPath, script.title, thumbnailPath);
      console.log('[videoBuilder] Thumbnail created');
    } catch (err) {
      console.warn('[videoBuilder] Thumbnail failed:', err.message);
      thumbnailPath = null;
    }
  }

  console.log('[videoBuilder] Video ready:', path.basename(videoPath));
  return { videoPath, thumbnailPath };
}

module.exports = { buildVideo };
