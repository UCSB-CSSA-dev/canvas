// Regenerates the derived brand images from assets/brand/logo.webp (640×193, transparent):
//   assets/brand/logo-on-dark.webp  full lockup with the dark text recolored for the dark theme
//   assets/brand/logo-mark.webp     phoenix + "UCSB CSSA" wordmark, without the text block
//   app/icon.png                    favicon (phoenix only)
//   app/apple-icon.png              iOS home-screen icon (phoenix on the app background)
//   public/brand/icon-{192,512}.png web app manifest icons (app/manifest.ts)
// Run with `npm run brand --workspace frontend` after replacing logo.webp. The crop boxes
// below are measured on the current logo and need re-measuring if its layout changes.
// Uses the sharp copy that Next.js installs.
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const file = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const SOURCE = file("assets/brand/logo.webp");
const BACKGROUND = { r: 10, g: 10, b: 10, alpha: 1 };

/** Everything right of this x is the text block (divider line + names). */
const TEXT_START_X = 358;
const MARK = { left: 0, top: 0, width: 376, height: 160 };
const PHOENIX = { left: 170, top: 0, width: 165, height: 110 };

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const raw = (buffer) => sharp(buffer, { raw: { width, height, channels: 4 } });
const isGrey = (buffer, i) => {
  const max = Math.max(buffer[i], buffer[i + 1], buffer[i + 2]);
  const min = Math.min(buffer[i], buffer[i + 1], buffer[i + 2]);
  return max - min < 40 && max < 170;
};

const onDark = Buffer.from(data);
const mark = Buffer.from(data);
for (let y = 0; y < height; y++) {
  for (let x = TEXT_START_X; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!isGrey(data, i)) continue;
    onDark[i] = onDark[i + 1] = onDark[i + 2] = 240;
    mark[i + 3] = 0;
  }
}

await raw(onDark).webp({ quality: 90 }).toFile(file("assets/brand/logo-on-dark.webp"));
await raw(mark).extract(MARK).webp({ quality: 90 }).toFile(file("assets/brand/logo-mark.webp"));

const phoenix = await sharp(SOURCE).extract(PHOENIX).png().toBuffer();
/** Share of the side the phoenix fills. iOS and Android round the corners of app icons. */
const APP_ICON_FILL = 0.84;
const square = (background, fill = 1) => {
  const side = Math.round(Math.max(PHOENIX.width, PHOENIX.height) / fill);
  return sharp({ create: { width: side, height: side, channels: 4, background } })
    .composite([{ input: phoenix, gravity: "center" }])
    .png()
    .toBuffer();
};

await sharp(await square({ r: 0, g: 0, b: 0, alpha: 0 })).resize(128, 128).png().toFile(file("app/icon.png"));
await sharp(await square(BACKGROUND, APP_ICON_FILL)).resize(180, 180).png().toFile(file("app/apple-icon.png"));
for (const size of [192, 512]) {
  await sharp(await square(BACKGROUND, APP_ICON_FILL))
    .resize(size, size)
    .png({ palette: true, quality: 90 })
    .toFile(file(`public/brand/icon-${size}.png`));
}

console.log("Brand assets written.");
