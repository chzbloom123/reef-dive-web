// Screenshot tool: builds the site, serves it locally, and photographs every viewpoint in each preset.
//
//   npm run capture                                  all viewpoints, both presets
//   npm run capture -- --vp=vp_overview              one viewpoint
//   npm run capture -- --preset=low --no-build       reuse the last build
//   npm run capture -- --cam=0,-5,10,0,-10,0         a one-off camera (x,y,z of eye, then of target)
//
//   build (dist/) ─> local preview server ─> Chrome opens ?vp=…&preset=…&capture=1
//        ─> page settles and sets window.__reefReady ─> screenshot ─> screenshots/<vp>_<preset>_<time>.png
//
// Chrome runs headed (a visible window) because headless browsers often fall back to software
// rendering, which is slow and can draw 3D differently from a real graphics chip.

import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPOINT_NAMES } from '../src/scene/viewpoints.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'screenshots');

function readArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [key, value] = a.replace(/^--/, '').split('=');
      return [key, value ?? true];
    }),
  );
  return {
    viewpoints: args.cam ? ['cam'] : args.vp ? String(args.vp).split(',') : VIEWPOINT_NAMES,
    cam: args.cam ? String(args.cam) : null,
    presets: args.preset ? String(args.preset).split(',') : ['low', 'high'],
    build: !args['no-build'],
  };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const { viewpoints, presets, cam, build: shouldBuild } = readArgs();
  await mkdir(outDir, { recursive: true });

  if (shouldBuild) {
    console.log('Building site...');
    await build({ root, logLevel: 'warn' });
  }

  const server = await preview({ root, preview: { port: 4317, strictPort: false }, logLevel: 'warn' });
  const baseUrl = server.resolvedUrls.local[0];
  console.log(`Preview server at ${baseUrl}`);

  // channel: 'chrome' uses the Chrome already installed on this PC, with its real GPU drivers.
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const stamp = timestamp();
  const saved = [];

  try {
    for (const presetName of presets) {
      for (const vp of viewpoints) {
        const page = await context.newPage();
        page.on('console', (msg) => {
          if (msg.type() === 'error' || msg.type() === 'warning') console.log(`  [page ${msg.type()}] ${msg.text()}`);
        });
        page.on('pageerror', (err) => console.log(`  [page error] ${err.message}`));

        const view = cam ? `cam=${cam}` : `vp=${vp}`;
        await page.goto(`${baseUrl}?${view}&preset=${presetName}&capture=1`);
        await page.waitForFunction(() => window.__reefReady === true, null, { timeout: 30000 });

        if (saved.length === 0) {
          // Report which graphics chip drew the frames, so we know it wasn't software rendering.
          const gpu = await page.evaluate(() => {
            const gl = document.createElement('canvas').getContext('webgl2');
            const info = gl?.getExtension('WEBGL_debug_renderer_info');
            return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
          });
          console.log(`GPU: ${gpu}`);
        }

        const file = path.join(outDir, `${vp}_${presetName}_${stamp}.png`);
        await page.screenshot({ path: file });
        saved.push(path.relative(root, file));
        console.log(`  saved ${path.relative(root, file)}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }

  console.log(`Done: ${saved.length} screenshot(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
