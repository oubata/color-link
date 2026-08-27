/**
 * Rasterise the app icon into the PNGs the manifest and iOS need.
 *
 *   npm run icons
 *
 * There is no image dependency in this project (spec 11.4), so the artwork is
 * drawn as SVG and screenshotted by the same headless browser the verification
 * harness already drives. Re-run this after editing the artwork below.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../verify/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', '..', 'public');

/** The favicon artwork, on a 64-unit grid: two dots joined by a bent line. */
const ARTWORK = `
  <path d="M18 22 H40 a6 6 0 0 1 6 6 v14" fill="none" stroke="#118AB2"
        stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="18" cy="22" r="7" fill="#D62828" />
  <circle cx="46" cy="42" r="7" fill="#D62828" />
`;

/**
 * `inset` is the share of the canvas left as margin around the 64-unit
 * artwork. Maskable icons need their content inside the middle 80%, so they
 * get a wide margin and a full-bleed background; the rest get rounded corners.
 */
function svg({ size, inset, radius }) {
  const box = 64 / (1 - 2 * inset);
  const offset = box * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
    viewBox="0 0 ${box} ${box}">
    <rect width="${box}" height="${box}" rx="${radius * box}" fill="#FFFFFF" />
    <g transform="translate(${offset} ${offset})">${ARTWORK}</g>
  </svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, inset: 0.06, radius: 0.1875 },
  { file: 'icon-512.png', size: 512, inset: 0.06, radius: 0.1875 },
  // Full-bleed square: the launcher applies its own mask.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.18, radius: 0 },
  // iOS applies its own rounding and dislikes transparency.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.08, radius: 0 },
];

const page = await launch({
  port: 9334,
  profile: join(HERE, '.icon-profile'),
});

try {
  // Keep the alpha channel, so the rounded corners are really cut out.
  await page.setTransparentBackground(true);

  for (const icon of ICONS) {
    await page.blank();
    await page.setViewport(icon.size, icon.size, 1, false);
    await page.evaluate(`
      document.body.style.margin = '0';
      document.body.innerHTML = ${JSON.stringify(svg(icon))};
      return 1;
    `);
    await page.screenshot(join(PUBLIC, icon.file));
    console.log(`  ${icon.file}  ${icon.size}x${icon.size}`);
  }
} finally {
  await page.close();
}
