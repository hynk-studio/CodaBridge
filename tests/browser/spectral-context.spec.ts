import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { workspaceView } from "./navigation.ts";
const cache = "data/raw/spectral-context-v1/";
test("spectral import, failure, complete export and mobile layout", async ({ page }, info) => {
  test.skip(!existsSync(cache + "codasp.csv") || !existsSync(cache + "codasp_w_urn.csv"), "Fetch the pinned sources with npm run spectral:fetch.");
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
    await page.getByLabel("Raw URN code", { exact: true }).selectOption("-1");
    await expect(page.getByText("31 / 1375 records", { exact: false })).toBeVisible();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download source-bound join report" }).click();
    const download = await pending; const path = info.outputPath("joined.json"); await download.saveAs(path);
    const data = JSON.parse(await readFile(path, "utf8"));
    expect(data.rows).toHaveLength(1375); expect(data.waveformMapping).toBe("unavailable");
    expect(data.summary.rawAIS["1*"]).toBe(11); expect(data.sources[0].sha256).toHaveLength(64);
    if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("spectral-loaded.png"), fullPage: true });
    await input.setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("bad") });
    await expect(page.getByRole("button", { name: "Download source-bound join report" })).toHaveCount(0);
  }
  if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("spectral.png"), fullPage: true });
  expect(posts).toEqual([]);
});
