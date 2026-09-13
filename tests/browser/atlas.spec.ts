import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { workspaceView, composerView } from "./navigation.ts";
import { STORAGE_KEY, projectJson } from "../../src/composer/project.ts";
import { createDraft } from "../../src/composer/model.ts";
import { ATLAS_MANIFEST } from "../../src/atlas/load.ts";
import { compareWithAtlas, type AtlasReport } from "../../src/atlas/model.ts";
import { inputFor } from "../fixtures/provider.ts";
import { composerInput } from "../fixtures/composer-provider.ts";
import { labInput } from "../fixtures/lab-provider.ts";
const atlasBytes = await readFile("public/style-atlas-v1/atlas.json");
const atlas: AtlasReport = JSON.parse(atlasBytes.toString());
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
async function enterAtlas(page: Page) {
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
}
async function make(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
}
async function save(page: Page, button: string, path: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const download = await pending; await download.saveAs(path);
  const bytes = await readFile(path);
  return { bytes, json: JSON.parse(bytes.toString()), filename: download.suggestedFilename() };
}

test("full Atlas journey: current comparison, actual downloads, whole reconstruction and preserved private work", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const dir = `test-results/style-atlas/${info.project.name}`; await mkdir(dir, { recursive: true });
  const posts: string[] = [], errors: string[] = [], assets: string[] = [];
  page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); if (r.url().includes("/style-atlas-v1/")) assets.push(r.url()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    const events: { kind: string; samples?: number }[] = [];
    Object.assign(window, { __atlasAudio: events });
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function(...args) { events.push({ kind: "start", samples: this.buffer!.length }); return start.apply(this, args); };
    AudioBufferSourceNode.prototype.stop = function(...args) { events.push({ kind: "stop" }); return stop.apply(this, args); };
  });
  await make(page); expect(assets).toEqual([]);
  await composerView(page, "edit");
  await page.getByLabel("Phrase title", { exact: true }).fill("TEST ONLY private atlas title");
  await page.getByLabel("Phrase title", { exact: true }).blur();
  await page.getByLabel("Meaning I assign", { exact: false }).fill("TEST ONLY private code");
  await page.getByLabel("Meaning I assign", { exact: false }).blur();
  await page.getByRole("button", { name: "Duplicate block", exact: true }).click();
  await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  await composerView(page, "save");
  await page.getByRole("button", { name: "Save active block to codebook", exact: true }).click();
  const before = await stored(page), block = before.draft.blocks.find((b: any) => b.id === before.activeId);
  await composerView(page, "compare");
  const panel = page.getByRole("region", { name: "Observed timing reference", exact: true });
  await expect(panel.getByTestId("composer-atlas-comparison")).toBeVisible();
  const expected = compareWithAtlas({ blockId: block.id, revision: before.draft.revision, times: block.times }, atlas, ATLAS_MANIFEST.report);
  await expect(panel.getByTestId("composer-atlas-comparison")).toHaveAttribute("data-binding", expected.binding);
  await panel.evaluate(e => e.scrollIntoView({ block: "start" })); await page.screenshot({ path: `${dir}/comparison.png` });
  const comparison = await save(page, "Download current comparison JSON", `${dir}/comparison.json`);
  expect(comparison.json).toEqual(expected);
  expect(comparison.bytes.toString()).not.toContain("TEST ONLY private");
  expect(comparison.json).not.toHaveProperty("codebook"); expect(comparison.json).not.toHaveProperty("draft");
  await page.getByRole("button", { name: /^Block 1/ }).click();
  await expect(panel.getByTestId("composer-atlas-comparison")).not.toHaveAttribute("data-binding", expected.binding);
  await page.getByRole("button", { name: /^Block 2/ }).click();
  await expect(panel.getByTestId("composer-atlas-comparison")).toHaveAttribute("data-binding", expected.binding);
  await panel.locator(".atlas-nearest summary").click();
  await panel.getByRole("button", { name: `Inspect annotated row ${expected.nearest[0].sourceLine}`, exact: true }).click();
  await expect(page.getByLabel("Atlas click count", { exact: true })).toHaveValue("6");
  await expect(page.getByTestId("atlas-selected")).toHaveAttribute("data-source-row", String(expected.nearest[0].sourceLine));
  expect(await stored(page)).toEqual(before);
  expect(await page.evaluate(() => (window as any).__atlasAudio)).toEqual([]);
  await page.getByRole("heading", { name: "Timing / Style Atlas", exact: true }).evaluate(e => e.scrollIntoView({ block: "start" })); await page.screenshot({ path: `${dir}/atlas.png` });
  await page.getByTestId("atlas-selected").evaluate(e => e.scrollIntoView({ block: "start" })); await page.screenshot({ path: `${dir}/actual-row.png` });
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("29");
  const long = atlas.records.find(r => r.clicks.length === 29)!;
  await expect(page.getByTestId("atlas-selected")).toHaveAttribute("data-source-row", String(long.sourceLine));
  await expect(page.getByTestId("style-atlas").getByText("Sparse reference.", { exact: true })).toBeVisible();
  expect(await page.locator(".atlas .atlas-band").count()).toBe(0);
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await expect(page.getByTestId("style-atlas").getByText("Playing synthetic clicks", { exact: true })).toBeVisible();
  const started = await page.evaluate(() => (window as any).__atlasAudio);
  expect(started.at(-1)).toEqual({ kind: "start", samples: Math.ceil((long.duration + .05 + .04) * 48000) });
  await page.getByRole("button", { name: "Stop Atlas audio", exact: true }).click();
  await expect(page.getByTestId("style-atlas").getByText("Synthetic playback stopped", { exact: true })).toBeVisible();
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("17");
  await expect(page.getByTestId("atlas-selected")).toHaveAttribute("data-source-row", "2");
  await page.getByRole("button", { name: "Normalized positions", exact: true }).click();
  await expect(page.getByTestId("atlas-selected").getByRole("img")).toHaveAttribute("aria-label", /17 clicks.*normalized scale/);
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await page.getByRole("button", { name: "Next row", exact: true }).click();
  await expect(page.getByTestId("style-atlas").getByText("Synthetic playback stopped", { exact: true })).toBeVisible();
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("2");
  await expect(page.getByTestId("style-atlas")).toContainText("Two-click shape is nondiscriminating");
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("26");
  await expect(page.getByTestId("style-atlas")).toContainText("No retained records for this click count");
  const download = await save(page, "Download sourced Atlas JSON", `${dir}/atlas.json`);
  expect(download.bytes.length).toBe(ATLAS_MANIFEST.report.bytes); expect(hash(download.bytes)).toBe(ATLAS_MANIFEST.report.sha256);
  expect(download.json.records).toHaveLength(3790); expect(download.json.exclusions).toHaveLength(50);
  await page.getByRole("button", { name: "← Return to my Composer", exact: true }).click();
  expect(await stored(page)).toEqual(before);
  await composerView(page, "edit"); await page.getByRole("button", { name: "Undo", exact: true }).click();
  await composerView(page, "compare");
  await expect(page.getByTestId("composer-atlas-comparison")).not.toHaveAttribute("data-binding", expected.binding);
  await composerView(page, "edit"); await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await stored(page)).draft.blocks).toEqual(before.draft.blocks); expect((await stored(page)).codebook).toEqual(before.codebook);
  const imported = createDraft("dswp-7");
  await page.getByLabel("Open Composer project", { exact: true }).setInputFiles({ name: "test-only-project.json", mimeType: "application/json", buffer: Buffer.from(projectJson(imported, [])) });
  await composerView(page, "compare");
  const afterImport = await save(page, "Download current comparison JSON", `${dir}/import-comparison.json`);
  expect(afterImport.json.currentTiming.times).toEqual(imported.blocks[0].times);
  expect(afterImport.json.currentTiming.blockId).toBe(imported.blocks[0].id);
  expect(errors).toEqual([]); expect(posts).toEqual([]);
  // Separate direct refusal probes, not model execution or UI requests.
  const refusals = [];
  for (const path of ["/api/investigate", "/api/composer", "/api/lab"]) {
    const response = await request.post(path, { data: path === "/api/investigate" ? inputFor() : path === "/api/composer" ? composerInput() : labInput(), headers: { origin: "http://127.0.0.1:4173" } });
    expect(response.status()).toBe(503); expect((await response.json()).code).toBe("NOT_CONFIGURED"); refusals.push({ path, status: 503, code: "NOT_CONFIGURED" });
  }
  await writeFile(`${dir}/evidence.json`, JSON.stringify({ source: "Actual unchanged archive; only creator labels are TEST ONLY", viewport: info.project.use.viewport, atlasBytes: download.bytes.length, atlasSha256: hash(download.bytes), comparisonBytes: comparison.bytes.length, comparisonSha256: hash(comparison.bytes), sourceSha256: atlas.sourceSha256, methodSha256: atlas.methodSha256, assets, pageErrors: errors, pageModelPosts: posts, refusals, audio: await page.evaluate(() => (window as any).__atlasAudio), retainedPrivateState: true, undoRedoImportRecomputed: true }, null, 2));
});

test("Atlas keyboard, 320px enlarged text, actual sorting, sparse and numeric alternatives", async ({ page }, info) => {
  const dir = `test-results/style-atlas/${info.project.name}`; await mkdir(dir, { recursive: true });
  await make(page); await enterAtlas(page);
  await expect(page.getByLabel("Atlas click count", { exact: true })).toHaveValue("5");
  await page.setViewportSize({ width: 320, height: 844 }); await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("24");
  await page.getByTestId("atlas-selected").evaluate(e => e.scrollIntoView({ block: "start" })); await page.screenshot({ path: `${dir}/narrow-enlarged.png` });
  expect(await page.locator(".atlas .atlas-band").count()).toBe(0);
  await page.getByRole("button", { name: "Normalized positions", exact: true }).press("Enter");
  await page.getByText("Every click position as numbers", { exact: true }).click();
  await expect(page.getByText(/Click 24:/)).toBeVisible();
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("5");
  await page.getByLabel("Atlas reference sort", { exact: true }).selectOption("duration");
  const shortest = atlas.records.filter(r => r.clicks.length === 5).sort((a, b) => a.duration - b.duration || a.sourceLine - b.sourceLine)[0];
  await expect(page.getByTestId("atlas-selected")).toHaveAttribute("data-source-row", String(shortest.sourceLine));
  await page.getByRole("region", { name: "Annotated row gap measurements", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/narrow-gaps.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Download sourced Atlas JSON", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/narrow-download.png` });
  await page.getByRole("button", { name: "← Return to my Composer", exact: true }).click();
  await composerView(page, "compare");
  await expect(page.getByTestId("composer-atlas-comparison")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator(".observed-reference").evaluate(e => e.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${dir}/narrow-comparison.png` });
});

test("TEST ONLY failed loading/hash/size responses show no results and support explicit retry", async ({ page }) => {
  const summary = await readFile("public/style-atlas-v1/summary.json");
  for (const failure of ["network", "size", "hash", "schema"]) {
    await page.route("**/style-atlas-v1/summary.json", async route => {
      if (failure === "network") return route.abort();
      if (failure === "size") return route.fulfill({ body: "{}", headers: { 'content-length': '9000000' } });
      const modified = Buffer.from(summary); modified[0] = failure === "hash" ? 32 : 91;
      return route.fulfill({ body: modified, contentType: "application/json" });
    });
    await page.goto("/"); await enterAtlas(page);
    await expect(page.getByRole("button", { name: "Retry Atlas loading", exact: true })).toBeVisible();
    await expect(page.getByTestId("style-atlas")).toHaveCount(0);
    await page.unroute("**/style-atlas-v1/summary.json");
  }
  await page.getByRole("button", { name: "Retry Atlas loading", exact: true }).click();
  await expect(page.getByTestId("atlas-selected")).toBeVisible();
});

test("TEST ONLY delayed archive cannot bind a comparison to an old selected block", async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let intercepted = false;
  await page.route("**/style-atlas-v1/atlas.json", async route => { intercepted = true; await gate; await route.fulfill({ body: atlasBytes, contentType: "application/json" }).catch(() => {}); });
  await make(page); await composerView(page, "compare");
  await expect(page.getByText("Loading source-checked timing reference…", { exact: true })).toBeVisible();
  await expect.poll(() => intercepted).toBe(true);
  await composerView(page, "edit"); await page.getByRole("button", { name: "Duplicate block", exact: true }).click();
  await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  release(); await page.unroute("**/style-atlas-v1/atlas.json");
  const now = await stored(page), active = now.draft.blocks.find((b: any) => b.id === now.activeId);
  await composerView(page, "compare");
  const expected = compareWithAtlas({ blockId: active.id, revision: now.draft.revision, times: active.times }, atlas, ATLAS_MANIFEST.report);
  await expect(page.getByTestId("composer-atlas-comparison")).toHaveAttribute("data-binding", expected.binding);
  await expect(page.getByTestId("composer-atlas-comparison")).toContainText(active.times.at(-1).toFixed(6));
});

test("TEST ONLY unavailable audio leaves sourced inspection and downloads usable", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "AudioContext", { value: undefined }); });
  await page.goto("/"); await enterAtlas(page);
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await expect(page.getByTestId("style-atlas")).toContainText("Visual inspection and downloads remain available");
  await expect(page.getByRole("button", { name: "Download sourced Atlas JSON", exact: true })).toBeEnabled();
});

test("Atlas keeps field, Composer and descriptive sound exclusive and resets both Prediction Reveals", async ({ page }) => {
  await make(page);
  await page.getByRole("button", { name: "Play whole phrase", exact: true }).click();
  await enterAtlas(page);
  await expect(page.locator('[aria-label="Synthetic playback status"]')).toHaveText("Stopped");
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await page.getByRole("button", { name: "Normalized positions", exact: true }).click();
  await expect(page.getByTestId("style-atlas").getByText("Synthetic playback stopped", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Descriptive pairing", exact: true }).click();
  await page.getByRole("button", { name: "Play annotated timing window", exact: true }).click();
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
  await expect(page.getByTestId("style-atlas").getByText("Synthetic playback stopped", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await workspaceView(page, "Listen");
  await page.getByRole("button", { name: "Play recording A", exact: true }).click();
  await workspaceView(page, "Context Lab");
  expect(await page.locator("audio").evaluateAll(elements => elements.every(e => (e as HTMLAudioElement).paused))).toBe(true);
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
  await expect(page.getByTestId("prediction-target")).toBeVisible();
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await page.getByRole("button", { name: "Reveal v0.2 actual next coda", exact: true }).click();
  await expect(page.getByTestId("research-target")).toBeVisible();
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await expect(page.getByTestId("research-target")).toHaveCount(0);
});
