import { readFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import gifenc from "gifenc";
import { decompress } from "wawoff2";
import { remainingParts } from "./invite-time.js";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const SCALE = 2;
const TILE_W = 148 * SCALE;
const TILE_H = 112 * SCALE;
const GAP = 10 * SCALE;
const RADIUS = 16 * SCALE;
export const COUNTDOWN_WIDTH = (TILE_W * 3 + GAP * 2) / SCALE;
export const COUNTDOWN_HEIGHT = TILE_H / SCALE;

const CARD = "#22243a";
const TILE = "#1b1d2c";
const WHITE = "#ffffff";
const GREY = "#8b93a7";

let fontPromise;

function ensureFont() {
  if (!fontPromise) {
    fontPromise = decompress(readFileSync(new URL("../assets/fonts/manrope-800.woff2", import.meta.url)))
      .then((ttf) => {
        GlobalFonts.register(Buffer.from(ttf), "ManropeEmail");
      });
  }
  return fontPromise;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function paint(parts) {
  const width = TILE_W * 3 + GAP * 2;
  const height = TILE_H;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, width, height);
  const tiles = [
    [parts.expired ? "00" : parts.hours, "HOURS"],
    [parts.expired ? "00" : parts.minutes, "MINUTES"],
    [parts.expired ? "00" : parts.seconds, "SECONDS"]
  ];
  tiles.forEach(([value, label], index) => {
    const x = index * (TILE_W + GAP);
    ctx.fillStyle = TILE;
    roundRect(ctx, x, 0, TILE_W, TILE_H, RADIUS);
    ctx.fillStyle = WHITE;
    ctx.font = `800 ${34 * SCALE}px ManropeEmail`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, x + TILE_W / 2, TILE_H * 0.4);
    ctx.fillStyle = GREY;
    ctx.font = `700 ${11 * SCALE}px ManropeEmail`;
    ctx.fillText(label, x + TILE_W / 2, TILE_H * 0.78);
  });
  return ctx.getImageData(0, 0, width, height);
}

export async function renderCountdownGif(expiresAt, now = Date.now()) {
  await ensureFont();
  const at = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  const first = remainingParts(at, now);
  const frames = first.expired ? 1 : Math.min(60, Math.max(1, Math.ceil(first.left / 1000)));
  const sample = paint(first);
  const palette = quantize(sample.data, 32);
  const gif = GIFEncoder();
  const width = sample.width;
  const height = sample.height;
  for (let i = 0; i < frames; i += 1) {
    const image = i === 0 ? sample : paint(remainingParts(at, now + i * 1000));
    gif.writeFrame(applyPalette(image.data, palette), width, height, {
      palette,
      delay: 1000,
      repeat: 0
    });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
