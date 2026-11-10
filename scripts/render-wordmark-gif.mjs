import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import playwright from "playwright";

const WIDTH = 796;
const HEIGHT = 214;
const FRAMES = 42;
const FPS = 12;
const OUT_DIR = "public/email";
const FRAME_DIR = "/tmp/wordmark-frames";

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Fraunces Site";
    src: url("file:///workspace/assets/fonts/fraunces-variable.woff2") format("woff2");
    font-weight: 100 900;
    font-style: normal;
  }
  html, body { margin: 0; background: #22243a; }
  .stage {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #22243a;
  }
  .wordmark {
    display: inline-flex;
    align-items: baseline;
    margin: 0;
    color: #fff;
    font-family: "Fraunces Site", serif;
    font-weight: 900;
    font-size: 148px;
    font-variation-settings: "SOFT" 100, "opsz" 144, "wght" 900;
    line-height: 1;
    letter-spacing: -0.045em;
  }
  .wm-bot {
    display: block;
    align-self: baseline;
    height: 1ex;
    margin: 0 0.03em;
    line-height: 0;
  }
  .wm-square { width: 1ex; }
  .wm-cloud { width: calc(1ex * 87.33 / 48.01); }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .eyes { transform-box: fill-box; transform-origin: center; }
</style>
</head>
<body>
  <div class="stage">
    <div class="wordmark" aria-label="Botomatic">
      <span>B</span>
      <span class="wm-bot wm-square">
        <svg viewBox="0.1 0.8 38.7 38.7">
          <g transform="rotate(-8 22 38)">
            <rect x="4" y="2" width="36" height="36" rx="11" fill="#a3d32b" />
            <g class="eyes" id="square-eyes">
              <circle cx="18" cy="20" r="3.4" fill="#fff" />
              <circle cx="27" cy="20" r="3.4" fill="#fff" />
            </g>
          </g>
        </svg>
      </span>
      <span>t</span>
      <span class="wm-bot wm-cloud">
        <svg viewBox="0 7.99 87.33 48.01">
          <path fill="#FF3E9A" transform="matrix(1.515 0 0 1.515 -12.7 -20.46)" d="M16 42c-6 0-9-5-7-10 1-6 8-9 13-6 2-7 12-10 18-4 7-6 18-2 18 7 6 0 10 6 7 12-2 4-8 7-14 5-4 5-14 6-20 2-2 2-8 2-15-6z" />
          <g class="eyes" id="cloud-eyes">
            <circle cx="26.7" cy="31.05" r="7.6" fill="#fff" />
            <circle cx="47.9" cy="31.05" r="7.6" fill="#fff" />
          </g>
        </svg>
      </span>
      <span>matic</span>
    </div>
  </div>
</body>
</html>`;

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
  const squareLook = look(t, 0);
  const cloudLook = look(t, 0.12);
  return {
    square: { x: squareLook * 3.2, y: Math.abs(squareLook) * -0.4, sy: blink(t, 0.66) },
    cloud: { x: cloudLook * 6.4, y: Math.abs(cloudLook) * -0.6, sy: blink(t, 0.74) }
  };
}

mkdirSync(FRAME_DIR, { recursive: true });
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const fontCheck = await page.evaluate(() => {
  const node = document.querySelector(".wordmark");
  const style = getComputedStyle(node);
  return {
    family: style.fontFamily,
    variation: style.fontVariationSettings,
    weight: style.fontWeight,
    letter: style.letterSpacing
  };
});
console.log("wordmark font", JSON.stringify(fontCheck));
if (!String(fontCheck.variation || "").includes("SOFT")) {
  throw new Error("The site Fraunces variation settings were not applied.");
}

for (let i = 0; i < FRAMES; i += 1) {
  const poseNow = pose(i / FRAMES);
  await page.evaluate(({ square, cloud }) => {
    const set = (id, eye) => {
      const node = document.getElementById(id);
      node.style.transform = `translate(${eye.x}px, ${eye.y}px) scaleY(${eye.sy})`;
    };
    set("square-eyes", square);
    set("cloud-eyes", cloud);
  }, poseNow);
  const file = `${FRAME_DIR}/frame-${String(i).padStart(3, "0")}.png`;
  await page.locator(".stage").screenshot({ path: file });
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
