import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

execFileSync("npx", ["esbuild", "e2e/edit-harness.js", "--bundle", "--format=iife", "--outfile=/tmp/edit-harness.js", "--jsx=automatic", "--loader:.js=jsx"], {
  cwd: fileURLToPath(new URL("..", import.meta.url))
});
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const script = readFileSync("/tmp/edit-harness.js");
const pageHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;

function serve() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(pageHtml);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`edit bot ${viewport.width}`, () => {
    let server;
    test.beforeAll(async () => { server = await serve(); });
    test.afterAll(() => server?.close());
    test.use({ viewport });

    test("the card stays within 90vh and the buttons remain visible", async ({ page }) => {
      const { port } = server.address();
      await page.goto(`http://127.0.0.1:${port}/bots`);
      await page.getByRole("button", { name: "Edit" }).click();
      const metrics = await page.evaluate(() => {
        const dialog = document.querySelector("dialog");
        const save = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Save");
        const cancel = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Cancel");
        const backdrop = getComputedStyle(dialog, "::backdrop");
        const box = dialog.getBoundingClientRect();
        const saveBox = save.getBoundingClientRect();
        const cancelBox = cancel.getBoundingClientRect();
        return {
          dialogBottom: Math.round(box.bottom),
          dialogHeight: Math.round(box.height),
          limit: Math.round(window.innerHeight * 0.9) + 2,
          saveBottom: Math.round(saveBox.bottom),
          cancelBottom: Math.round(cancelBox.bottom),
          viewport: window.innerHeight,
          backdrop: backdrop.backgroundColor,
          blur: backdrop.backdropFilter || backdrop.webkitBackdropFilter || "none",
          shadow: getComputedStyle(dialog).boxShadow
        };
      });
      expect(metrics.dialogHeight).toBeLessThanOrEqual(metrics.limit);
      expect(metrics.saveBottom).toBeLessThanOrEqual(metrics.viewport - 4);
      expect(metrics.cancelBottom).toBeLessThanOrEqual(metrics.viewport - 4);
      expect(metrics.backdrop).toBe("rgba(0, 0, 0, 0.55)");
      expect(metrics.blur === "none" || metrics.blur === "").toBe(true);
      expect(metrics.shadow.includes("64px")).toBe(false);
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(450);
      const open = await page.evaluate(() => Boolean(document.querySelector("dialog")?.open));
      expect(open).toBe(false);
    });
  });
}
