import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { workspaceView } from "./navigation.ts";
test("native source/rate selection and actual complete comparison download", async ({ page }, info) => {
  const posts: string[] = []; page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/"); await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
  await workspaceView(page, "Context Lab"); await page.getByRole("button", { name: "Spectrum / Environment", exact: true }).click();
  await expect(page.getByText("6 detected transient groups", { exact: false })).toBeVisible();
  await page.getByLabel("Measurement sample rate").selectOption("16000");
  await expect(page.getByText("7 detected transient groups", { exact: false })).toBeVisible();
  await page.getByLabel("Field recording", { exact: true }).selectOption("2");
  await expect(page.getByText("6 detected transient groups", { exact: false })).toBeVisible();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download native spectrum comparison" }).click();
  const download = await pending; const path = info.outputPath("native.json"); await download.saveAs(path);
  const data = JSON.parse(await readFile(path, "utf8")); expect(data.selection).toEqual({ id: "dswp-11", rate: 16000 }); expect(data.clips).toHaveLength(4);
  if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("native.png"), fullPage: true });
  expect(posts).toEqual([]);
});
test("native missing asset has an explicit unavailable state", async ({ page }) => {
  await page.route("**/native-spectrum-v1/report.json", route => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/#context-lab"); await page.getByRole("button", { name: "Spectrum / Environment", exact: true }).click();
  await expect(page.getByText("Native spectral measurements are unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download native spectrum comparison" })).toHaveCount(0);
});
