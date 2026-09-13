import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { composerView, labView, workspaceView } from "./navigation.ts";
import { STORAGE_KEY } from "../../src/composer/project.ts";
import { validatePredictionSummary } from "../../src/lab/prediction.ts";
import { inputFor } from "../fixtures/provider.ts";
import { composerInput } from "../fixtures/composer-provider.ts";
import { labInput } from "../fixtures/lab-provider.ts";
const bytes = await readFile("public/prediction/summary.json", "utf8"), summary = validatePredictionSummary(JSON.parse(bytes));
async function prediction(page: Page) {
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await expect(page.getByText("Precomputed held-out prediction", { exact: true })).toBeVisible();
}
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

test("actual offline Prediction journey: cutoff, compare, Reveal, lagged results, delivered JSON and preserved Composer", async ({ page, request }, info) => {
  const directory = `test-results/dialogue-transfer/${info.project.name}`;
  await mkdir(directory, { recursive: true });
  const posts: string[] = [], errors: string[] = [];
  page.on("request", req => { if (req.method() === "POST") posts.push(req.url()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { __predictionAudio: events });
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function(...args) { events.push("start"); return start.apply(this, args); };
    AudioBufferSourceNode.prototype.stop = function(...args) { events.push("stop"); return stop.apply(this, args); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
  await composerView(page, "edit");
  await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  await page.getByLabel("Phrase title", { exact: true }).fill("Prediction preservation check");
  await page.getByLabel("Phrase title", { exact: true }).blur();
  await composerView(page, "save");
  await page.getByRole("button", { name: "Save active block to codebook", exact: true }).click();
  const before = await stored(page);
  await composerView(page, "edit");
  await page.getByRole("button", { name: "Play whole phrase", exact: true }).click();
  await labView(page, "explore");
  await page.getByRole("button", { name: "Play annotated timing window", exact: true }).click();
  await prediction(page);
  const audioAtEntry = await page.evaluate(() => (window as any).__predictionAudio);
  expect(audioAtEntry.at(-1)).toBe("stop");
  const example = summary.selectedExamples[0];
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await expect(page.locator("[data-actual]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask Astra", exact: true })).toHaveCount(0);
  await expect(page.locator(".prediction-mode")).not.toContainText(`row ${example.target.sourceLine}`);
  await expect(page.locator(`[data-source-row="${example.target.sourceLine}"]`)).toHaveCount(0);
  const ax = await page.locator(".prediction-mode").ariaSnapshot();
  expect(ax).not.toContain(`row ${example.target.sourceLine}`);
  expect(ax).not.toContain(`${example.target.duration.toFixed(4)} s`);
  await writeFile(`${directory}/before-reveal-accessibility.txt`, ax);
  await page.locator(".prediction-distributions").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/before-reveal.png`, fullPage: false });
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
  await expect(page.getByTestId("prediction-target")).toContainText(`${example.target.duration.toFixed(4)} s`);
  await expect(page.getByTestId("prediction-target")).toContainText(`row ${example.target.sourceLine}`);
  expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThan(400); // no forced jump to the study result
  await page.getByTestId("prediction-target").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/revealed.png`, fullPage: false });
  await expect(page.locator(".prediction-study")).toContainText("+0.00220");
  await expect(page.locator(".prediction-study")).toContainText("interval includes zero");
  await page.locator(".prediction-study").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/study.png`, fullPage: false });
  await page.getByText("Paired comparisons, groups and fold boundaries", { exact: true }).click();
  await expect(page.locator(".prediction-study")).toContainText("-0.01796");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sourced prediction JSON", exact: true }).click();
  const download = await pending; await download.saveAs(`${directory}/browser-delivered.json`);
  const delivered = await readFile(`${directory}/browser-delivered.json`);
  expect(createHash("sha256").update(delivered).digest("hex")).toBe(summary.report.sha256);
  expect(delivered.length).toBe(summary.report.bytes);
  const report = JSON.parse(delivered.toString());
  expect(report.records).toHaveLength(summary.cohort.eligibleExamples);
  expect(report.status).toBe("completed");
  await page.getByLabel("Held-out prediction example", { exact: true }).selectOption("1");
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await expect(page.locator("[data-actual]")).toHaveCount(0);
  await page.getByLabel("Held-out prediction example", { exact: true }).selectOption("0");
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await page.getByRole("button", { name: "Descriptive pairing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play annotated timing window", exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "← Return to my Composer", exact: true }).click();
  await composerView(page, "edit");
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue("Prediction preservation check");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Phrase title", { exact: true })).not.toHaveValue("Prediction preservation check");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue("Prediction preservation check");
  expect((await stored(page)).codebook).toEqual(before.codebook);
  expect(await page.evaluate(() => (window as any).__predictionAudio)).toEqual(audioAtEntry);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
  const refusals: object[] = [];
  for (const path of ["/api/investigate", "/api/composer", "/api/lab"]) {
    const response = await request.post(path, { data: path === "/api/investigate" ? inputFor() : path === "/api/composer" ? composerInput() : labInput(), headers: { origin: "http://127.0.0.1:4173" } });
    expect(response.status()).toBe(503); expect((await response.json()).code).toBe("NOT_CONFIGURED");
    refusals.push({ path, status: response.status(), code: "NOT_CONFIGURED" });
  }
  await writeFile(`${directory}/browser-evidence.json`, JSON.stringify({ identity: "Real pinned-source prediction UI; no model fixture or paid request", viewport: info.project.use.viewport, reportSha256: summary.report.sha256, bytes: delivered.length, revealReset: true, noPreRevealTargetInAccessibility: true, noPredictionAudio: true, composerPreserved: true, pageErrors: errors, modelPostsFromPage: posts, defaultRefusals: refusals }, null, 2));
});

test("Prediction remains usable at 320 px and 200% text enlargement", async ({ page }, info) => {
  await page.goto("/"); await prediction(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).press("Enter");
  await expect(page.getByTestId("prediction-target")).toBeVisible();
  await page.getByRole("button", { name: "Download sourced prediction JSON", exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: `test-results/prediction-320-enlarged-${info.project.name}.png` });
});

test("TEST ONLY failed, insufficient, zero and negative states are explicit", async ({ page }) => {
  let state = "failed";
  await page.route("**/prediction/summary.json", route => {
    const s = JSON.parse(bytes);
    s.limitations.unshift("TEST ONLY synthetic presentation state; not an experiment result.");
    if (["failed", "insufficient-data"].includes(state)) Object.assign(s, { status: state, failures: [{ reason: "TEST ONLY missing eligible groups or failed fold" }], metrics: null, uncertainty: null, selectedExamples: [] });
    else s.metrics.gainBits.M2_vs_M1 = state === "zero" ? 0 : -.25;
    return route.fulfill({ json: s });
  });
  for (state of ["failed", "insufficient-data", "zero", "negative"]) {
    await page.goto("/"); await prediction(page);
    if (["zero", "negative"].includes(state)) await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
    await expect(page.getByRole("heading", { name: state === "failed" ? "Experiment failed — no primary estimate" : state === "insufficient-data" ? "Insufficient data — no primary estimate" : state === "zero" ? "No measured predictive gain" : "Partner history worsened pooled prediction", exact: true })).toBeVisible();
  }
});

test("TEST ONLY loading and report failures do not fabricate successful delivery", async ({ page }) => {
  let unavailable = true, downloads = 0;
  await page.route("**/prediction/summary.json", route => unavailable ? route.fulfill({ status: 503, body: "Unavailable" }) : route.fulfill({ body: bytes, contentType: "application/json" }));
  await page.goto("/"); await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prediction unavailable", exact: true })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Try loading the saved experiment again", exact: true }).click();
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
  await page.route("**/prediction/dialogue-transfer-report.json", route => route.fulfill({ body: "{}", contentType: "application/json" }));
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download sourced prediction JSON", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Report size does not match");
  expect(downloads).toBe(0);
});
