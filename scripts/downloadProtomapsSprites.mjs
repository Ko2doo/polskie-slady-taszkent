// One-shot script to download Protomaps basemap sprite assets
// (PNG + JSON) for offline use in the app.
//
// It will fetch files like:
//   light.png, light.json, light@2x.png, light@2x.json
//   dark.png,  dark.json,  dark@2x.png,  dark@2x.json
// and store them under "public/map/sprites".
//
// Usage:
//   node scripts/download-protomaps-sprites.mjs

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const SPRITE_REMOTE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4';
const SPRITE_LOCAL_DIR = 'public/map/sprites';

const THEMES = ['light', 'dark'];
const SCALES = ['', '@2x']; // '' for 1x, '@2x' for retina

// Helper: download a single URL to a local file using https
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const file = fs.createWriteStream(dest);

    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});

          return reject(new Error(`Request failed for ${url}: ${res.statusCode}`));
        }

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(dest);
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  const tasks = [];

  for (const theme of THEMES) {
    for (const scale of SCALES) {
      const suffix = scale;
      const remotePng = `${SPRITE_REMOTE_BASE}/${theme}${suffix}.png`;
      const remoteJson = `${SPRITE_REMOTE_BASE}/${theme}${suffix}.json`;

      const localPng = path.join(`${SPRITE_LOCAL_DIR}/${theme}`, `${theme}${suffix}.png`);
      const localJson = path.join(`${SPRITE_LOCAL_DIR}/${theme}`, `${theme}${suffix}.json`);

      console.log(`-> queue: ${remotePng} -> ${localPng}`);
      console.log(`-> queue: ${remoteJson} -> ${localJson}`);

      tasks.push(downloadFile(remotePng, localPng), downloadFile(remoteJson, localJson));
    }
  }

  try {
    await Promise.all(tasks);
    console.log('✅ All sprite assets downloaded to', SPRITE_LOCAL_DIR);
  } catch (error) {
    console.error('❌ Failed to download sprites:', error);
    process.exit(1);
  }
}

await main();
