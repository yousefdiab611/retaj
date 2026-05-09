#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-require-imports */
/**
 * Generates platform icons from public/brand/retaj-icon-source.svg:
 *   - public/retaj-icon.png  (512x512, used by macOS/Linux + Electron BrowserWindow)
 *   - public/retaj-icon.ico  (multi-resolution Windows icon)
 *
 * Run via `npm run build:icons` from the frontend workspace, or
 * automatically before electron-builder via the electron:stage-backend
 * step.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
// png-to-ico v3 is pure ESM, so importing it from a .cjs file requires a
// dynamic import. We unwrap the module's default export inside main().

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const SOURCE = path.join(PUBLIC_DIR, "brand", "retaj-icon-source.svg");
const PNG_OUT = path.join(PUBLIC_DIR, "retaj-icon.png");
const ICO_OUT = path.join(PUBLIC_DIR, "retaj-icon.ico");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("missing source SVG at", SOURCE);
    process.exit(1);
  }
  const svg = fs.readFileSync(SOURCE);

  const pngToIcoMod = await import("png-to-ico");
  const pngToIco = pngToIcoMod.default ?? pngToIcoMod;

  console.log("--> writing 512x512 PNG");
  await sharp(svg).resize(512, 512).png().toFile(PNG_OUT);

  console.log("--> rendering ICO frames");
  const buffers = [];
  for (const size of ICO_SIZES) {
    buffers.push(await sharp(svg).resize(size, size).png().toBuffer());
  }
  const ico = await pngToIco(buffers);
  fs.writeFileSync(ICO_OUT, ico);

  console.log("==> icons built");
  console.log("    ", path.relative(process.cwd(), PNG_OUT));
  console.log("    ", path.relative(process.cwd(), ICO_OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
