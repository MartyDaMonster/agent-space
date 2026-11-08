import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
execFileSync("npx", ["esbuild", "e2e/harness.js", "--bundle", "--format=iife", "--outfile=/tmp/dialog-harness.js", "--jsx=automatic", "--loader:.js=jsx"], {
  cwd: fileURLToPath(new URL("..", import.meta.url))
});
const script = readFileSync("/tmp/dialog-harness.js");

const pageHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${script}</script>
</body>
</html>`;

function serve() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(pageHtml);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function openDialog(page) {
  await page.getByRole("button", { name: "Delete comment" }).click();
  await expect(page.getByRole("heading", { name: "Delete this comment?" })).toBeVisible();
}

async function settled(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector("dialog");
    const story = document.getElementById("story");
    const backdrop = dialog ? getComputedStyle(dialog, "::backdrop").backgroundColor : "";
    const box = dialog ? dialog.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      open: Boolean(dialog?.open),
      locked: document.body.classList.contains("modal-open"),
      overflow: getComputedStyle(document.body).overflow,
      story: Boolean(story?.isConnected),
      storyText: story?.textContent || "",
      backdrop,
      dialogWidth: Math.round(box.width),
      dialogHeight: Math.round(box.height),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      stored: localStorage.length + sessionStorage.length
    };
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 }
]) {
  test.describe(`${viewport.width}px`, () => {
    let server;
    test.beforeAll(async () => {
      server = await serve();
    });
    test.afterAll(() => server?.close());
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      const { port } = server.address();
      await page.goto(`http://127.0.0.1:${port}/p/botomatic-promotional-video`);
    });

    test("opens over a see-through page and does not restore itself", async ({ page }) => {
      const before = await settled(page);
      expect(before.open).toBe(false);
      expect(before.story).toBe(true);
      expect(before.stored).toBe(0);
      await openDialog(page);
      const during = await settled(page);
      expect(during.story).toBe(true);
      expect(during.storyText).toContain("stays mounted");
      expect(during.backdrop).toBe("rgba(0, 0, 0, 0.5)");
      expect(during.dialogWidth).toBeLessThan(during.viewportWidth);
      expect(during.dialogHeight).toBeLessThan(during.viewportHeight - 80);
      expect(during.locked).toBe(true);
      await page.reload();
      const after = await settled(page);
      expect(after.open).toBe(false);
      expect(after.locked).toBe(false);
      expect(after.story).toBe(true);
    });

    async function expectClosed(page) {
      await expect.poll(() => settled(page)).toMatchObject({ open: false, locked: false, story: true });
      const state = await settled(page);
      expect(state.overflow).not.toBe("hidden");
    }

    test("the X button closes it and restores the page", async ({ page }) => {
      await openDialog(page);
      await page.getByRole("button", { name: "Close" }).click();
      await expectClosed(page);
    });

    test("Cancel closes it and restores the page", async ({ page }) => {
      await openDialog(page);
      await page.getByRole("button", { name: "Cancel" }).click();
      await expectClosed(page);
    });

    test("the backdrop click closes it and restores the page", async ({ page }) => {
      await openDialog(page);
      await page.mouse.click(8, 8);
      await expectClosed(page);
    });

    test("Escape closes it and restores the page", async ({ page }) => {
      await openDialog(page);
      await page.keyboard.press("Escape");
      await expectClosed(page);
    });

    test("a route change closes it and the page content stays mounted until then", async ({ page }) => {
      await openDialog(page);
      const mounted = await page.locator("#story").textContent();
      expect(mounted).toContain("stays mounted");
      await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
      await expect.poll(() => page.evaluate(() => document.body.classList.contains("modal-open") || Boolean(document.querySelector("dialog[open]")))).toBe(false);
      await expect(page.locator("#story")).toContainText("stays mounted");
      await openDialog(page);
      await page.evaluate(() => document.getElementById("leave").click());
      await expect(page.locator("#left")).toHaveText("Left the project page.");
      await expect.poll(() => page.evaluate(() => document.body.classList.contains("modal-open") || Boolean(document.querySelector("dialog[open]")))).toBe(false);
    });
  });
}
