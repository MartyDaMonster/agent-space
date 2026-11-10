import gifenc from "gifenc";
import { remainingParts } from "./invite-time.js";

const { GIFEncoder } = gifenc;

const WIDTH = 480;
const HEIGHT = 148;
const PALETTE = [
  [18, 19, 28],
  [34, 36, 58],
  [255, 255, 255],
  [139, 147, 167]
];

const DIGIT = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10001", "10001", "10001", "11111", "00001", "00001", "00001"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

const TINY = {
  A: ["010", "101", "111", "101", "101"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  " ": ["000", "000", "000", "000", "000"]
};

function stamp(index, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  index[y * WIDTH + x] = color;
}

function blit(index, glyph, x, y, scale, color) {
  glyph.forEach((row, dy) => {
    [...row].forEach((bit, dx) => {
      if (bit !== "1") return;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) stamp(index, x + dx * scale + sx, y + dy * scale + sy, color);
      }
    });
  });
}

function textWidth(text, scale, font) {
  const sample = font["0"] || font.A;
  const advance = sample[0].length * scale + scale;
  return text.length * advance - scale;
}

function drawText(index, text, x, y, scale, color, font) {
  const sample = font[text[0]] || font[" "];
  const advance = sample[0].length * scale + scale;
  [...text].forEach((char, i) => {
    blit(index, font[char] || font[" "], x + i * advance, y, scale, color);
  });
}

function fill(index, color) {
  index.fill(color);
}

function rect(index, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) stamp(index, xx, yy, color);
  }
}

function paint(parts) {
  const index = new Uint8Array(WIDTH * HEIGHT);
  fill(index, 0);
  const tiles = [
    [parts.expired ? "--" : parts.hours, "HOURS"],
    [parts.expired ? "--" : parts.minutes, "MINUTES"],
    [parts.expired ? "--" : parts.seconds, "SECONDS"]
  ];
  tiles.forEach(([value, label], i) => {
    const x = 12 + i * 156;
    rect(index, x, 8, 144, 132, 1);
    const digits = value.padStart(2, "0").slice(-2);
    const dw = textWidth(digits, 6, DIGIT);
    drawText(index, digits, x + Math.round((144 - dw) / 2), 24, 6, 2, DIGIT);
    const lw = textWidth(label, 2, TINY);
    drawText(index, label, x + Math.round((144 - lw) / 2), 108, 2, 4, TINY);
  });
  if (parts.expired) {
    const word = "EXPIRED";
    const ww = textWidth(word, 3, TINY);
    drawText(index, word, Math.round((WIDTH - ww) / 2), 64, 3, 3, TINY);
  }
  return index;
}

export function renderCountdownGif(expiresAt, now = Date.now()) {
  const gif = GIFEncoder();
  const at = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  const first = remainingParts(at, now);
  const frames = first.expired ? 1 : Math.min(60, Math.max(1, Math.ceil(first.left / 1000)));
  for (let i = 0; i < frames; i += 1) {
    const parts = remainingParts(at, now + i * 1000);
    gif.writeFrame(paint(parts), WIDTH, HEIGHT, {
      palette: PALETTE,
      delay: 1000,
      repeat: 0,
      colorDepth: 2
    });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
