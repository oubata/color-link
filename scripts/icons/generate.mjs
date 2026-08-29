/**
 * Rasterise the app icon into the PNGs the manifest, iOS and Android need.
 *
 *   npm run icons
 *
 * There is no image dependency in this project (spec 11.4), so the artwork is
 * drawn as SVG and screenshotted by the same headless browser the verification
 * harness already drives. Re-run this after editing the artwork below.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../verify/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PUBLIC = join(ROOT, 'public');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

/** The favicon artwork, on a 64-unit grid: two dots joined by a bent line. */
const ARTWORK = `
  <path d="M18 22 H40 a6 6 0 0 1 6 6 v14" fill="none" stroke="#118AB2"
        stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="18" cy="22" r="7" fill="#D62828" />
  <circle cx="46" cy="42" r="7" fill="#D62828" />
`;

/**
 * `inset` is the share of the canvas left as margin around the 64-unit
 * artwork. `shape` is what sits behind it: a rounded square, a circle, or
 * nothing at all for an adaptive foreground, whose background is a separate
 * layer the launcher composites underneath.
 */
function svg({ size, inset, shape = 'rounded', radius = 0.1875 }) {
  const box = 64 / (1 - 2 * inset);
  const offset = box * inset;
  const background =
    shape === 'circle'
      ? `<circle cx="${box / 2}" cy="${box / 2}" r="${box / 2}" fill="#FFFFFF" />`
      : shape === 'rounded'
        ? `<rect width="${box}" height="${box}" rx="${radius * box}" fill="#FFFFFF" />`
        : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
    viewBox="0 0 ${box} ${box}">
    ${background}
    <g transform="translate(${offset} ${offset})">${ARTWORK}</g>
  </svg>`;
}

const WEB_ICONS = [
  { file: join(PUBLIC, 'icon-192.png'), size: 192, inset: 0.06 },
  { file: join(PUBLIC, 'icon-512.png'), size: 512, inset: 0.06 },
  // Full-bleed square: the launcher applies its own mask.
  {
    file: join(PUBLIC, 'icon-maskable-512.png'),
    size: 512,
    inset: 0.18,
    radius: 0,
  },
  // iOS applies its own rounding and dislikes transparency.
  {
    file: join(PUBLIC, 'apple-touch-icon.png'),
    size: 180,
    inset: 0.08,
    radius: 0,
  },
];

/**
 * Android launcher icons. Adaptive foregrounds are 108dp with only the middle
 * 72dp guaranteed visible, so the artwork sits well inside that.
 */
const DENSITIES = [
  { dir: 'mdpi', legacy: 48, foreground: 108 },
  { dir: 'hdpi', legacy: 72, foreground: 162 },
  { dir: 'xhdpi', legacy: 96, foreground: 216 },
  { dir: 'xxhdpi', legacy: 144, foreground: 324 },
  { dir: 'xxxhdpi', legacy: 192, foreground: 432 },
];

const androidIcons = () =>
  DENSITIES.flatMap(({ dir, legacy, foreground }) => {
    const into = join(ANDROID_RES, `mipmap-${dir}`);
    return [
      { file: join(into, 'ic_launcher.png'), size: legacy, inset: 0.08 },
      {
        file: join(into, 'ic_launcher_round.png'),
        size: legacy,
        inset: 0.1,
        shape: 'circle',
      },
      {
        file: join(into, 'ic_launcher_foreground.png'),
        size: foreground,
        inset: 0.26,
        shape: 'none',
      },
    ];
  });

const targets = [...WEB_ICONS];
if (existsSync(ANDROID_RES)) {
  targets.push(...androidIcons());
} else {
  console.log('  (no android/ project yet, skipping launcher icons)');
}

const page = await launch({
  port: 9334,
  profile: join(HERE, '.icon-profile'),
});

try {
  // Keep the alpha channel, so the rounded corners are really cut out.
  await page.setTransparentBackground(true);

  for (const icon of targets) {
    await page.blank();
    await page.setViewport(icon.size, icon.size, 1, false);
    await page.evaluate(`
      document.body.style.margin = '0';
      document.body.innerHTML = ${JSON.stringify(svg(icon))};
      return 1;
    `);
    mkdirSync(dirname(icon.file), { recursive: true });
    await page.screenshot(icon.file);
    console.log(
      `  ${icon.file.replace(ROOT, '.').replace(/\\/g, '/')}  ${icon.size}px`,
    );
  }
} finally {
  await page.close();
}
