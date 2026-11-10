import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import playwright from "playwright";

const WIDTH = 796;
const HEIGHT = 214;
const FRAMES = 42;
const FPS = 12;
const OUT_DIR = "public/email";
const FRAME_DIR = "/tmp/wordmark-frames";
const PAGE = process.env.WORDMARK_FRAME_URL || "http://127.0.0.1:3066/dev/wordmark-frame";

function smooth(u) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

function between(t, a, b) {
  if (t < a || t >= b) return null;
  return (t - a) / (b - a);
}

function look(t, shift) {
  const u = (t + shift) % 1;
  const left = between(u, 0.08, 0.24);
  const back = between(u, 0.24, 0.36);
  const right = between(u, 0.36, 0.52);
  const home = between(u, 0.52, 0.64);
  if (left != null) return -smooth(left);
  if (back != null) return -smooth(1 - back);
  if (right != null) return smooth(right);
  if (home != null) return smooth(1 - home);
  return 0;
}

function blink(t, start) {
  const u = between(t, start, start + 0.09);
  if (u == null) return 1;
  const close = Math.sin(Math.min(1, u) * Math.PI);
  return 1 - close * 0.9;
}

function pose(t) {
  return {
    square: { x: look(t, 0) * 0.12, y: 0, sy: blink(t, 0.66) },
    cloud: { x: look(t, 0.12) * 0.14, y: 0, sy: blink(t, 0.74) }
  };
}

mkdirSync(FRAME_DIR, { recursive: true });
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 320 }, deviceScaleFactor: 1 });
await page.goto(PAGE, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const fontCheck = await page.evaluate(() => {
  const node = document.querySelector("#wordmark-frame .wordmark");
  if (!node) return null;
  const style = getComputedStyle(node);
  return {
    family: style.fontFamily,
    variation: style.fontVariationSettings,
    weight: style.fontWeight,
    letter: style.letterSpacing
  };
});
console.log("wordmark font", JSON.stringify(fontCheck));
if (!fontCheck || !String(fontCheck.variation || "").includes("SOFT") || !String(fontCheck.variation).includes("wght")) {
  throw new Error("The real site wordmark font was not loaded.");
}

for (let i = 0; i < FRAMES; i += 1) {
  const poseNow = pose(i / FRAMES);
  await page.evaluate(({ square, cloud }) => {
    const set = (selector, eye) => {
      const node = document.querySelector(selector);
      node.style.transform = `translate(${eye.x}em, ${eye.y}em) scaleY(${eye.sy})`;
    };
    set(".wm-square .blink", square);
    set(".wm-cloud .blink", cloud);
  }, poseNow);
  const file = `${FRAME_DIR}/frame-${String(i).padStart(3, "0")}.png`;
  await page.locator("#wordmark-frame").screenshot({ path: file });
}
await browser.close();

const gif = `${OUT_DIR}/wordmark.gif`;
const palette = "/tmp/wordmark-palette.png";
const gen = spawnSync("ffmpeg", [
  "-y", "-framerate", String(FPS),
  "-i", `${FRAME_DIR}/frame-%03d.png`,
  "-vf", "palettegen=max_colors=48:stats_mode=diff",
  palette
], { stdio: "inherit" });
if (gen.status !== 0) process.exit(gen.status || 1);
const use = spawnSync("ffmpeg", [
  "-y", "-framerate", String(FPS),
  "-i", `${FRAME_DIR}/frame-%03d.png`,
  "-i", palette,
  "-lavfi", "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
  "-loop", "0",
  gif
], { stdio: "inherit" });
if (use.status !== 0) process.exit(use.status || 1);
copyFileSync(`${FRAME_DIR}/frame-000.png`, "/tmp/wordmark-still.png");
console.log("wrote", gif);
