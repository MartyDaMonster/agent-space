import { readFileSync } from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { hoursLeftLabel } from "./invite-time.js";

export const COUNTDOWN_WIDTH = 480;
export const COUNTDOWN_HEIGHT = 96;
export const COUNTDOWN_DISPLAY_WIDTH = 240;
export const COUNTDOWN_DISPLAY_HEIGHT = 48;

const PINK = "#ff3e9a";
const CARD = "#22243a";

let fontReady = false;

function ensureFont() {
  if (fontReady) return;
  const file = path.join(process.cwd(), "assets/fonts/fraunces-black-soft.woff2");
  GlobalFonts.register(readFileSync(file), "FrauncesEmail");
  fontReady = true;
}

export async function renderCountdownPng(expiresAt, now = Date.now()) {
  const label = hoursLeftLabel(expiresAt, now);
  ensureFont();
  const canvas = createCanvas(COUNTDOWN_WIDTH, COUNTDOWN_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, COUNTDOWN_WIDTH, COUNTDOWN_HEIGHT);
  ctx.fillStyle = PINK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 64;
  ctx.font = `900 ${size}px FrauncesEmail, serif`;
  const measured = ctx.measureText(label).width;
  if (measured > COUNTDOWN_WIDTH - 32) {
    size = Math.max(28, Math.floor(size * (COUNTDOWN_WIDTH - 32) / measured));
    ctx.font = `900 ${size}px FrauncesEmail, serif`;
  }
  ctx.fillText(label, COUNTDOWN_WIDTH / 2, COUNTDOWN_HEIGHT / 2 + 2);
  return canvas.toBuffer("image/png");
}
