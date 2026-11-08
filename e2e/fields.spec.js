import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

execFileSync("npx", ["esbuild", "e2e/fields-harness.js", "--bundle", "--format=iife", "--outfile=/tmp/fields-harness.js", "--jsx=automatic", "--loader:.js=jsx"], {
  cwd: fileURLToPath(new URL("..", import.meta.url))
});
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const script = readFileSync("/tmp/fields-harness.js");
const pageHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;

function serve() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(pageHtml);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`composer fields ${viewport.width}`, () => {
    let server;
    test.beforeAll(async () => { server = await serve(); });
    test.afterAll(() => server?.close());
    test.use({ viewport });

    test("the note is full width, six rows, focused, and the Post button states differ", async ({ page }) => {
      const { port } = server.address();
      await page.goto(`http://127.0.0.1:${port}/`);
      const note = page.locator("dialog textarea");
      await expect.poll(() => page.evaluate(() => document.querySelector("dialog")?.open && document.activeElement?.getAttribute("data-autofocus") != null)).toBe(true);
      const before = await note.evaluate((el) => {
        const dialog = el.closest("dialog");
        const post = document.getElementById("post");
        const postStyle = getComputedStyle(post);
        return {
          note: Math.round(el.getBoundingClientRect().width),
          dialog: Math.round(dialog.clientWidth),
          height: Math.round(el.getBoundingClientRect().height),
          rows: el.rows,
          disabledBg: postStyle.backgroundColor,
          disabledColor: postStyle.color
        };
      });
      expect(before.rows).toBeGreaterThanOrEqual(6);
      expect(before.note).toBeGreaterThan(before.dialog - 80);
      expect(before.height).toBeGreaterThanOrEqual(120);
      expect(before.disabledBg).not.toBe("rgb(198, 255, 61)");
      expect(before.disabledColor).not.toBe("rgb(17, 17, 17)");
      await note.fill(Array.from({ length: 10 }, () => "A note for the board.").join("\n"));
      const grown = await note.evaluate((el) => Math.round(el.getBoundingClientRect().height));
      expect(grown).toBeGreaterThan(before.height);
      const enabled = await page.locator("#post").evaluate((el) => {
        const style = getComputedStyle(el);
        return { bg: style.backgroundColor, color: style.color, disabled: el.disabled };
      });
      expect(enabled.disabled).toBe(false);
      expect(enabled.bg).toBe("rgb(198, 255, 61)");
      expect(enabled.color).toBe("rgb(17, 17, 17)");
    });

    test("the comment box is full width and grows", async ({ page }) => {
      const { port } = server.address();
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.getByRole("button", { name: "Close" }).click();
      const box = page.locator("#comment-form textarea");
      const before = await box.evaluate((el) => ({
        width: Math.round(el.getBoundingClientRect().width),
        form: Math.round(el.closest("form").clientWidth),
        height: Math.round(el.getBoundingClientRect().height)
      }));
      expect(before.width).toBeGreaterThan(before.form - 24);
      await box.fill(Array.from({ length: 8 }, () => "Another line of the comment.").join("\n"));
      const height = await box.evaluate((el) => Math.round(el.getBoundingClientRect().height));
      expect(height).toBeGreaterThan(before.height);
    });
  });
}
