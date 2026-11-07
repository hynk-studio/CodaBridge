import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { workspaceView } from "./navigation.ts";
const cache = "data/raw/spectral-context-v1/";
test("spectral import, failure, complete export and mobile layout", async ({ page }, info) => {
  expect(existsSync(cache + "codasp.csv") && existsSync(cache + "codasp_w_urn.csv"), "Run npm run spectral:fetch before browser acceptance").toBe(true);
  const posts: string[] = []; page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/"); await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Spectrum / Environment", exact: true }).click();
  await expect(page.getByText("External rows unavailable until", { exact: false })).toBeVisible();
  const input = page.getByLabel("Open both pinned CSV files");
  await input.setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("bad") });
  await expect(page.getByRole("status").filter({ hasText: "Select both pinned" })).toBeVisible();
  if (existsSync(cache + "codasp.csv") && existsSync(cache + "codasp_w_urn.csv")) {
    await input.setInputFiles([cache + "codasp.csv", cache + "codasp_w_urn.csv"]);
    await expect(page.getByText("Both complete files verified.", { exact: false })).toBeVisible();
    await expect(page.getByText("1375 / 1375 records", { exact: false })).toBeVisible();
    await page.getByRole("combobox", { name: "Coda type", exact: true }).selectOption("5R1");
    await expect(page.getByText("245 / 1375 records", { exact: false })).toBeVisible();
    await page.getByRole("combobox", { name: "Coda type", exact: true }).selectOption("");
    await page.getByText("Missingness, raw code counts and grouping support", { exact: true }).click();
    await expect(page.locator(".spectral-context details[open] pre")).toContainText('"unknownProducer": 108');
    await expect(page.locator(".spectral-context details[open] pre")).toContainText('"meandist_pk2": 1065');
    await page.getByRole("combobox", { name: "Raw URN code", exact: true }).selectOption("-1");
    await expect(page.getByText("31 / 1375 records", { exact: false })).toBeVisible();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download source-bound join report" }).click();
    const download = await pending; const path = info.outputPath("joined.json"); await download.saveAs(path);
    const data = JSON.parse(await readFile(path, "utf8"));
    expect(data.rows).toHaveLength(1375); expect(data.waveformMapping).toBe("unavailable");
    expect(data.selection).toEqual({ codaType: null, rawURN: "-1" });
    expect(data.summary.denominator).toBe(1375); expect(data.filteredSummary.denominator).toBe(31);
    expect(data.summary.rawAIS["1*"]).toBe(11); expect(data.sources[0].sha256).toBe("770af6f8057d6b88ccbf18b815015955795cbd7b20ae65733153d28cf117cb5b");
    expect(data.sources[1].revision).toBe("3c0fe9dc49c08c315995ae92e4de9045e07f2b82");
    expect(data.rows.filter((r: { interpreted: { whale: unknown } }) => r.interpreted.whale === null)).toHaveLength(108);
    expect(data.rows.filter((r: { raw: { URN: string }; interpreted: { URN: unknown } }) => r.raw.URN === "-1" && r.interpreted.URN === null)).toHaveLength(31);
    expect(data.rows.every((r: { spectralLine: number; environmentLine: number }) => r.spectralLine > 1 && r.environmentLine > 1)).toBe(true);
    if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const table = page.getByRole("region", { name: "Spectral context records" });
    if (info.project.name === "mobile-chromium") {
      await table.focus(); await table.press("ArrowRight");
      await expect.poll(() => table.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
      await table.evaluate(e => { e.scrollLeft = e.scrollWidth; });
      await table.screenshot({ path: info.outputPath("spectral-table-right.png") });
    }
    await page.screenshot({ path: info.outputPath("spectral-loaded.png"), fullPage: true });
    await input.setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("bad") });
    await expect(page.getByRole("button", { name: "Download source-bound join report" })).toHaveCount(0);
  }
  if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("spectral.png"), fullPage: true });
  expect(posts).toEqual([]);
});


test("same-sized corrupt source bytes reject the previous imported report", async ({ page }) => {
  await page.goto("/#context-lab");
  await page.getByRole("button", { name: "Spectrum / Environment", exact: true }).click();
  const input = page.getByLabel("Open both pinned CSV files");
  await input.setInputFiles([cache + "codasp.csv", cache + "codasp_w_urn.csv"]);
  await expect(page.getByText("Both complete files verified.", { exact: false })).toBeVisible();
  const corrupt = Buffer.from(await readFile(cache + "codasp.csv")); corrupt[corrupt.length - 2] ^= 1;
  await input.setInputFiles([
    { name: "codasp.csv", mimeType: "text/csv", buffer: corrupt },
    { name: "codasp_w_urn.csv", mimeType: "text/csv", buffer: await readFile(cache + "codasp_w_urn.csv") },
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Checksum mismatch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download source-bound join report" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Spectral context records" })).toHaveCount(0);
});

for (const action of ["replacement", "navigation"] as const) test(`pending CSV import is invalidated by ${action}`, async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { csvDigests: number }; state.csvDigests = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algorithm, data) => {
      const result = await digest(algorithm, data);
      if (data.byteLength === 81709 || data.byteLength === 100946) state.csvDigests++;
      return result;
    };
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name === "codasp.csv") await new Promise<void>(resolve => {
        (window as unknown as { releaseCsv: () => void }).releaseCsv = resolve;
      });
      return original.call(this);
    };
  });
  await page.goto("/#context-lab");
  await page.getByRole("button", { name: "Spectrum / Environment", exact: true }).click();
  const input = page.getByLabel("Open both pinned CSV files");
  await input.setInputFiles([cache + "codasp.csv", cache + "codasp_w_urn.csv"]);
  await expect(page.getByRole("status").filter({ hasText: "Verifying source bytes" })).toBeVisible();
  if (action === "replacement") await input.setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("bad") });
  else await workspaceView(page, "Composer");
  await page.evaluate(() => (window as unknown as { releaseCsv: () => void }).releaseCsv());
  await expect.poll(() => page.evaluate(() => (window as unknown as { csvDigests: number }).csvDigests)).toBe(2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  if (action === "navigation") await workspaceView(page, "Context Lab");
  await expect(page.getByRole("status").filter({ hasText: action === "replacement" ? "Select both pinned" : "Import canceled" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download source-bound join report" })).toHaveCount(0);
});
