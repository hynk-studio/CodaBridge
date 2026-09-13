import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { composerView, labView, workspaceView } from "./navigation.ts";
import { STORAGE_KEY } from "../../src/composer/project.ts";
import { RESEARCH_LABELS, researchFinding, validateResearchSummary } from "../../src/lab/researchPrediction.ts";
import { inputFor } from "../fixtures/provider.ts";
import { composerInput } from "../fixtures/composer-provider.ts";
import { labInput } from "../fixtures/lab-provider.ts";
const bytes = await readFile("public/prediction-v02/summary.json", "utf8"), summary = validateResearchSummary(JSON.parse(bytes));
async function research(page: Page) {
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await expect(page.getByText("Precomputed held-out research · v0.2", { exact: true })).toBeVisible();
}
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const target = (page: Page) => page.getByTestId("research-target");
const reveal = (page: Page) => page.getByRole("button", { name: "Reveal v0.2 actual next coda", exact: true });

test("actual v0.2: all endpoints, Reveal/reset, controls, delivered JSON and Composer/descriptive preservation", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const directory = `test-results/dialogue-transfer-v02/${info.project.name}`;
  await mkdir(directory, { recursive: true });
  const posts: string[] = [], errors: string[] = [];
  page.on("request", req => { if (req.method() === "POST") posts.push(req.url()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { __researchAudio: events });
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function(...args) { events.push("start"); return start.apply(this, args); };
    AudioBufferSourceNode.prototype.stop = function(...args) { events.push("stop"); return stop.apply(this, args); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
  await composerView(page, "edit");
  await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  await page.getByLabel("Phrase title", { exact: true }).fill("v0.2 research preservation");
  await page.getByLabel("Phrase title", { exact: true }).blur();
  await composerView(page, "save");
  await page.getByRole("button", { name: "Save active block to codebook", exact: true }).click();
  const before = await stored(page);
  await composerView(page, "edit");
  await page.getByRole("button", { name: "Play whole phrase", exact: true }).click();
  await labView(page, "explore");
  await page.getByRole("button", { name: "Play annotated timing window", exact: true }).click();
  await research(page);
  const audioAtEntry = await page.evaluate(() => (window as any).__researchAudio);
  expect(audioAtEntry.at(-1)).toBe("stop");
  const example = summary.examples[0];
  await expect(target(page)).toHaveCount(0);
  await expect(page.locator(".research-mode")).not.toContainText(`row ${example.target.sourceLine}`);
  await expect(page.locator(`[data-source-row="${example.target.sourceLine}"]`)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask Astra", exact: true })).toHaveCount(0);
  const ax = await page.locator(".research-mode").ariaSnapshot();
  expect(ax).not.toContain(`${example.target.duration.toFixed(4)} s`);
  expect(ax).not.toContain(`${example.gapSeconds.toFixed(4)} s`);
  expect(ax).not.toContain(`row ${example.target.sourceLine}`);
  await writeFile(`${directory}/before-reveal-accessibility.txt`, ax);
  for (const s of summary.studies.slice(0, 3)) {
    const row = page.getByRole("region", { name: RESEARCH_LABELS[s.id].title, exact: true });
    await expect(row).toContainText(s.selectedRecords[0].predictions.M1.nativePoint.toFixed(4));
    await expect(row).toContainText(s.selectedRecords[0].predictions.M2.nativePoint.toFixed(4));
  }
  await page.locator(".research-compare").evaluate(e => e.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${directory}/before-reveal.png` });
  await reveal(page).click();
  await expect(target(page)).toContainText(`${example.target.duration.toFixed(4)} s`);
  await expect(target(page)).toContainText(`${example.gapSeconds.toFixed(4)} s`);
  await expect(target(page)).toContainText(`Row ${example.target.sourceLine}`);
  await target(page).evaluate(e => e.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: `${directory}/revealed.png` });
  await expect(page.locator(".research-example-controls")).toContainText("fitted separately");
  for (const s of summary.studies) {
    const section = page.getByTestId(`research-study-${s.id}`);
    await expect(section.getByRole("heading", { name: researchFinding(s), exact: true })).toBeVisible();
    await expect(section).toContainText(s.metrics!.pooled!.gain.M2_vs_M1.toFixed(6));
    await expect(section).toContainText(RESEARCH_LABELS[s.id].unit);
    await expect(section).toContainText("conditional, descriptive");
    await section.evaluate(e => e.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `${directory}/study-${s.id}.png` });
    await section.getByText("Older control, every root and deletion influence", { exact: true }).click();
    await expect(section.locator("tbody tr")).toHaveCount(s.metrics!.groups);
    await expect(section).toContainText("not refitted validation");
    await section.getByText("Three prespecified history strata and fold details", { exact: true }).click();
    await expect(section).toContainText("At or below training-fold median");
    await expect(section).toContainText("No definite overlap");
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sourced v0.2 JSON", exact: true }).click();
  const download = await pending; await download.saveAs(`${directory}/browser-delivered.json`);
  expect(download.suggestedFilename()).toBe("codabridge-dialogue-transfer-v0.2.json");
  const delivered = await readFile(`${directory}/browser-delivered.json`);
  expect(createHash("sha256").update(delivered).digest("hex")).toBe(summary.report.sha256);
  expect(delivered.length).toBe(summary.report.bytes);
  expect(JSON.parse(delivered.toString()).studies.map((s: any) => s.records.length)).toEqual([723, 723, 723, 1017]);
  await page.getByLabel("Held-out v0.2 example", { exact: true }).selectOption("1");
  await expect(target(page)).toHaveCount(0);
  await reveal(page).click();
  await page.getByRole("button", { name: "Original study · v0.1", exact: true }).click();
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Positive pooled estimate — interval spans zero", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await expect(target(page)).toHaveCount(0);
  await reveal(page).click();
  await workspaceView(page, "Listen"); await workspaceView(page, "Context Lab");
  await expect(target(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Descriptive pairing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play annotated timing window", exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "← Return to my Composer", exact: true }).click();
  await composerView(page, "edit");
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue("v0.2 research preservation");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Phrase title", { exact: true })).not.toHaveValue("v0.2 research preservation");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue("v0.2 research preservation");
  expect((await stored(page)).codebook).toEqual(before.codebook);
  expect(await page.evaluate(() => (window as any).__researchAudio)).toEqual(audioAtEntry);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
  const refusals: object[] = [];
  for (const path of ["/api/investigate", "/api/composer", "/api/lab"]) {
    const response = await request.post(path, { data: path === "/api/investigate" ? inputFor() : path === "/api/composer" ? composerInput() : labInput(), headers: { origin: "http://127.0.0.1:4173" } });
    expect(response.status()).toBe(503); expect((await response.json()).code).toBe("NOT_CONFIGURED");
    refusals.push({ path, status: response.status(), code: "NOT_CONFIGURED" });
  }
  await writeFile(`${directory}/browser-evidence.json`, JSON.stringify({ identity: "Actual pinned-source v0.2 studies; no synthetic/model fixture", viewport: info.project.use.viewport, reportSha256: summary.report.sha256, bytes: delivered.length, targetAbsentBeforeReveal: true, revealResetOnExampleVersionWorkspace: true, noPredictionAudio: true, composerAndDescriptivePreserved: true, pageErrors: errors, pageModelPosts: posts, defaultRefusals: refusals }, null, 2));
});

test("v0.2 remains usable at 320 px with 200% text, including all result units and scrolling root tables", async ({ page }, info) => {
  await page.goto("/"); await research(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await reveal(page).press("Enter");
  await expect(target(page)).toBeVisible();
  for (const id of ["duration", "count", "gap", "coverage-duration"]) {
    const section = page.getByTestId(`research-study-${id}`);
    await section.evaluate(e => e.scrollIntoView({ block: "start" }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    if (id === "duration") await page.screenshot({ path: `test-results/v02-320-study-${info.project.name}.png` });
    await section.getByText("Older control, every root and deletion influence", { exact: true }).click();
    await section.locator(".research-table-wrap").focus();
    await section.locator(".research-table-wrap").press("ArrowRight");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  await page.getByRole("button", { name: "Download sourced v0.2 JSON", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/v02-320-download-${info.project.name}.png` });
});

test("TEST ONLY failed endpoints and loading/download failures never fabricate a score or successful delivery", async ({ page }) => {
  let unavailable = true, downloads = 0;
  const synthetic = JSON.parse(bytes); synthetic.status = "partial";
  for (const [i, status] of [[0, "failed"], [1, "insufficient-data"]] as const) Object.assign(synthetic.studies[i], { status, metrics: null, uncertainty: null, selectedRecords: [], failures: [{ reason: "TEST ONLY unavailable fold diagnostic" }], strata: {}, deletions: [] });
  synthetic.limitations.unshift("TEST ONLY UI failure fixture; not a new study or modified real artifact.");
  await page.route("**/prediction-v02/summary.json", route => unavailable ? route.fulfill({ status: 503, body: "TEST ONLY unavailable" }) : route.fulfill({ json: synthetic }));
  await page.goto("/"); await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "v0.2 research unavailable", exact: true })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Try loading v0.2 again", exact: true }).click();
  await expect(page.locator(".research-compare")).toContainText("Study failed — saved prediction unavailable");
  await expect(target(page)).toHaveCount(0);
  await reveal(page).click();
  await expect(page.getByRole("heading", { name: "Study failed — no estimate", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Insufficient data — no estimate", exact: true })).toBeVisible();
  await expect(page.getByTestId("research-study-gap")).toContainText("+0.001273");
  await page.route("**/prediction-v02/dialogue-transfer-report.json", route => route.fulfill({ body: "{}", contentType: "application/json" }));
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download sourced v0.2 JSON", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Report size does not match");
  expect(downloads).toBe(0);
});
