import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createWorker } from "../../server/worker.ts";
import { STORAGE_KEY } from "../../src/composer/project.ts";
import type { CompletedInvestigation } from "../../src/investigation.ts";
import type { ComposerResult } from "../../src/composer/contract.ts";
import type { LabResult } from "../../src/lab/contract.ts";
import { TEST_ENV, finalOutput, happyTransport, scriptedTransport } from "../fixtures/provider.ts";
import { composerTransport } from "../fixtures/composer-provider.ts";
import { labTransport } from "../fixtures/lab-provider.ts";
import { composerView, disclosure, labView, workspaceView } from "./navigation.ts";

type Surface = "pair" | "composer" | "lab";
type Result = CompletedInvestigation | ComposerResult | LabResult;
const surfaces: Surface[] = ["pair", "composer", "lab"];
const area = (page: Page, surface: Surface) => page.locator({ pair: ".investigation-panel", composer: ".composer-astra", lab: ".lab-ask" }[surface]);
const configured = "Astra isn't enabled for this deployment. Listening, creation, and local analysis still work.";
const unknown = "Astra is unavailable. Listening, creation, and local analysis still work.";
const failed = "Astra couldn't complete this request. Your work is unchanged.";

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.jpg`), quality: 75 });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual((await page.viewportSize())!.width);
}
async function fixture(page: Page, surface: Surface, mutate?: (result: Result) => void) {
  const mock = surface === "pair" ? happyTransport() : surface === "lab" ? labTransport() : composerTransport();
  const worker = createWorker(mock);
  const state = { posts: [] as string[], requests: [] as string[], external: [] as string[], results: [] as string[],
    failure: "" as "" | "configured" | "failed" | "network" | "malformed", statusFailure: false };
  await page.route("**/*", async route => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:4173") {
      state.external.push(route.request().url());
      await route.abort();
    } else await route.fallback();
  });
  page.on("request", req => {
    state.requests.push(req.url());
    if (req.method() === "POST") state.posts.push(req.url());
  });
  await page.route("**/api/**", async route => {
    const req = route.request();
    if (state.statusFailure || (req.method() === "POST" && state.failure === "network")) return route.abort();
    if (req.method() === "POST" && state.failure === "malformed")
      return route.fulfill({ status: 502, contentType: "text/plain", body: "TEST ONLY private parse sentinel" });
    if (req.method() === "POST" && state.failure === "failed")
      return route.fulfill({ status: 502, json: { status: "failed", code: "PROVIDER_FAILURE", message: "TEST ONLY private provider billing token sentinel" } });
    const response = await worker.fetch(new Request(req.url(), { method: req.method(), headers: req.headers(),
      ...(req.method() === "POST" ? { body: req.postData() } : {}),
    }), req.method() === "POST" && state.failure === "configured" ? {} : TEST_ENV);
    let body = await response.text();
    if (req.method() === "POST" && response.ok) {
      if (mutate) { const result = JSON.parse(body); mutate(result); body = JSON.stringify(result); }
      state.results.push(body);
    }
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body });
  });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const badge = document.createElement("div");
    badge.textContent = "TEST ONLY · local transport fixture · no live Astra call";
    badge.style.cssText = "position:fixed;top:0;right:0;z-index:9999;background:#f5d89f;color:#17241b;padding:4px 8px;font:12px sans-serif;max-width:100%;pointer-events:none";
    document.body.append(badge);
  }));
  return state;
}
async function open(page: Page, surface: Surface) {
  await page.goto("/");
  if (surface === "pair") await disclosure(page, ".optional-investigation");
  else if (surface === "lab") await page.getByRole("button", { name: "Investigate with Astra", exact: true }).click();
  else {
    await page.getByRole("button", { name: "Make my coda", exact: true }).click();
    await composerView(page, "compare");
    await page.getByLabel("Request type", { exact: true }).selectOption("investigate");
  }
}
async function ask(page: Page, surface: Surface) {
  await area(page, surface).getByRole("button", { name: surface === "pair" ? "Investigate selection" : "Ask Astra", exact: true }).click();
}
async function exportResult(page: Page, surface: Surface) {
  let name: string;
  if (surface === "pair") { await disclosure(page, ".evidence-panel"); name = "Download recording-comparison JSON"; }
  else if (surface === "lab") { await labView(page, "save"); name = "Download investigation JSON"; }
  else {
    await composerView(page, "save");
    await page.getByLabel("Include analysis evidence in project", { exact: false }).check();
    name = "Download project JSON";
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const bytes = await readFile((await (await pending).path())!, "utf8");
  const packet = JSON.parse(bytes);
  return { bytes, result: surface === "pair" ? packet.investigation : surface === "lab" ? packet.generated : packet.savedAnalysis.generated };
}

test("home Astra discovery is secondary, local, and navigates with Back/Forward and retained Lab modes", async ({ page }, info) => {
  const posts: string[] = [];
  page.on("request", req => { if (req.method() === "POST") posts.push(req.url()); });
  await page.goto("/");
  const entry = page.getByRole("button", { name: "Investigate with Astra", exact: true });
  await expect(entry).toBeVisible();
  await expect(entry).toBeInViewport();
  await expect(entry).toHaveAccessibleDescription("Compare evidence and controls with Astra.");
  await expect(page.locator(".quick-start .primary")).toHaveText("Make my coda");
  await expect(page.locator(".astra-activity:visible")).toHaveCount(0);
  await noOverflow(page);
  await capture(page, info, "home");
  await entry.press("Enter");
  await expect(page).toHaveURL(/#context-lab$/);
  await expect(page.getByRole("button", { name: "Descriptive pairing", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Compare pairings", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".context-lab")).toBeFocused();
  await expect(page.locator(".lab-ask")).toContainText(configured);
  await expect(page.getByRole("button", { name: "Ask Astra", exact: true })).toBeDisabled();
  await page.getByLabel("Duration assignment", { exact: true }).selectOption("1");
  await expect(page.locator(".lab-statistics")).toContainText("0.144 s");
  await page.locator(".lab-ask .astra-activity").scrollIntoViewIfNeeded();
  await capture(page, info, "unavailable");
  await page.goBack(); await expect(entry).toBeVisible();
  await page.goForward(); await expect(page.getByLabel("Duration assignment", { exact: true })).toHaveValue("1");
  for (const mode of ["Timing / Style Atlas", "Dialogue Transfer / Prediction"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await workspaceView(page, "Listen");
    await entry.click();
    await expect(page.getByRole("button", { name: "Descriptive pairing", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Duration assignment", { exact: true })).toHaveValue("1");
  }
  await page.getByRole("button", { name: "Explore exchange", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play annotated timing window", exact: true })).toBeEnabled();
  expect(posts).toEqual([]);
});

test("home Astra entry remains operable at 320 CSS px with 200% text and reduced motion", async ({ page }, info) => {
  const posts: string[] = [];
  page.on("request", req => { if (req.method() === "POST") posts.push(req.url()); });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  const entry = page.getByRole("button", { name: "Investigate with Astra", exact: true });
  await entry.scrollIntoViewIfNeeded();
  await expect(entry).toBeInViewport();
  await noOverflow(page);
  await capture(page, info, "home-320-enlarged");
  await entry.press("Enter");
  await expect(page.getByRole("button", { name: "Compare pairings", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Duration assignment", { exact: true }).selectOption("1");
  await noOverflow(page);
  expect(posts).toEqual([]);
});

for (const surface of surfaces) {
  test(`${surface}: readable citations open exact evidence by Tab and Enter without changing result or export bytes`, async ({ page }, info) => {
    // Freeze only the browser's export timestamp so complete file bytes can be compared.
    await page.clock.setFixedTime(new Date("2026-09-15T12:00:00Z"));
    const state = await fixture(page, surface);
    await open(page, surface);
    expect(state.posts).toEqual([]);
    await ask(page, surface);
    const result = area(page, surface).locator(".investigation-result, .composer-result, .lab-result");
    await expect(result).toBeVisible();
    const accepted = JSON.parse(state.results[0]) as Result;
    const before = await exportResult(page, surface);
    expect(JSON.stringify(before.result)).toBe(state.results[0]);
    if (surface === "composer") await composerView(page, "compare");
    if (surface === "lab") await labView(page, "compare");
    await disclosure(page, `${surface === "pair" ? ".investigation-result" : `.${surface}-result`} .exact-answer`);
    const answer = result.locator(".exact-answer");
    const rows = [...accepted.explanation!.possibleInterpretations, ...accepted.explanation!.limitations];
    const citations = answer.locator(".citation");
    await expect(citations).toHaveCount(rows.length);
    for (const item of accepted.evidence) expect((await citations.allTextContents()).join("\n")).not.toContain(item.id);
    const expectedLabel = surface === "pair" || surface === "composer" ? "Retrieval evidence" : "Comparison evidence";
    await expect(citations.first().getByRole("button").first()).toHaveText(expectedLabel);
    const storage = await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY);
    await page.waitForLoadState("networkidle");
    const traffic = [...state.requests];
    await result.scrollIntoViewIfNeeded();
    await capture(page, info, "readable-answer-TEST-ONLY");
    await answer.locator("summary").focus();
    await page.keyboard.press("Tab");
    await expect(citations.first().getByRole("button").first()).toBeFocused();
    for (const [rowIndex, row] of rows.entries()) for (const [i, id] of row.evidenceIds.entries()) {
      const button = citations.nth(rowIndex).getByRole("button").nth(i);
      await button.focus(); await page.keyboard.press("Enter");
      const targetIndex = accepted.evidence.findIndex(e => e.id === id);
      const target = result.locator(".supporting-evidence > .tool-evidence").nth(targetIndex);
      await expect(target).toHaveAttribute("open");
      await expect(target.locator("summary")).toBeFocused();
      await expect(target.locator("summary")).toHaveText(id);
      expect(JSON.parse((await target.locator("pre").textContent())!)).toEqual(accepted.evidence[targetIndex]);
    }
    await capture(page, info, "exact-evidence-TEST-ONLY");
    await noOverflow(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await citations.first().getByRole("button").first().press("Enter");
    await noOverflow(page);
    expect(state.requests).toEqual(traffic);
    expect(await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY)).toBe(storage);
    const after = await exportResult(page, surface);
    expect(after.bytes).toBe(before.bytes);
    expect(JSON.stringify(after.result)).toBe(state.results[0]);
    expect(state.posts).toHaveLength(1);
    expect(state.external).toEqual([]);
  });

  test(`${surface}: public request failures suppress internal details and preserve work`, async ({ page }, info) => {
    const state = await fixture(page, surface);
    await open(page, surface);
    const stored = await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY);
    const measured = surface === "lab" ? await page.locator(".lab-statistics").innerText() : "";
    for (const failure of ["failed", "configured", "network", "malformed"] as const) {
      state.failure = failure;
      await ask(page, surface);
      await expect(area(page, surface).locator(".astra-activity")).toHaveAttribute("data-state", surface === "pair" && failure === "configured" ? "unavailable" : "failed");
      await expect(area(page, surface)).toContainText(failure === "configured" ? configured : failed);
      await expect(area(page, surface)).not.toContainText(/sentinel|PROVIDER_FAILURE|NOT_CONFIGURED|API.?key|billing|token|502|503/);
      expect(await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY)).toBe(stored);
      if (surface === "lab") expect(await page.locator(".lab-statistics").innerText()).toBe(measured);
    }
    await area(page, surface).locator(".astra-activity").scrollIntoViewIfNeeded();
    await capture(page, info, "request-failed-TEST-ONLY");
    expect(state.posts).toHaveLength(4);
    expect(state.external).toEqual([]);
  });

  test(`${surface}: unknown status-check failure does not claim deployment configuration`, async ({ page }) => {
    const state = await fixture(page, surface); state.statusFailure = true;
    await open(page, surface);
    await expect(area(page, surface)).toContainText(unknown);
    await expect(area(page, surface)).not.toContainText("isn't enabled");
    expect(state.posts).toEqual([]);
  });
}

test("citations retain repeated-kind order and repetition with exact distinct targets", async ({ page }) => {
  const ids = ["recording:dswp-2", "recording:dswp-1"];
  const transport = scriptedTransport([finalOutput({
    possibleInterpretations: [{ text: "TEST ONLY source citation ordering.", evidenceIds: ids }],
    limitations: [{ text: "TEST ONLY annotations remain uncertain.", evidenceIds: [ids[0]] }],
  })]);
  const worker = createWorker(transport);
  await page.route("**/api/**", async route => {
    const req = route.request();
    const response = await worker.fetch(new Request(req.url(), { method: req.method(), headers: req.headers(),
      ...(req.method() === "POST" ? { body: req.postData() } : {}),
    }), TEST_ENV);
    await route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) });
  });
  await open(page, "pair"); await ask(page, "pair");
  await expect(page.locator(".investigation-result")).toBeVisible();
  await disclosure(page, ".investigation-result .exact-answer");
  const controls = page.locator(".citation").getByRole("button");
  await expect(controls).toHaveText(["Recording evidence 2", "Recording evidence 1", "Recording evidence 2"]);
  for (const [i, id] of [...ids, ids[0]].entries()) {
    await controls.nth(i).click();
    await expect(page.locator(`[id="evidence-${id}"] > summary`)).toBeFocused();
  }
  expect(transport.calls).toHaveLength(1);
});

for (const fault of ["missing", "ambiguous", "unknown-kind"] as const) {
  test(`TEST ONLY citation ${fault} uses a safe result-local fallback`, async ({ page }) => {
    const state = await fixture(page, "pair", result => {
      const item = result.evidence[0];
      result.explanation!.possibleInterpretations = [{ text: "TEST ONLY citation mapping fault.", evidenceIds: [item.id] }];
      if (fault === "missing") result.evidence.shift();
      else if (fault === "ambiguous") result.evidence.push({ ...item } as never);
      else (item as { kind: string }).kind = "unknown-kind";
    });
    await open(page, "pair"); await ask(page, "pair");
    await expect(page.locator(".investigation-result")).toBeVisible();
    await disclosure(page, ".investigation-result .exact-answer");
    const first = page.locator(".citation").first();
    await expect(first).toHaveText(fault === "unknown-kind" ? "Evidence 1" : "Evidence unavailable");
    if (fault === "unknown-kind") {
      await first.getByRole("button").click();
      await expect(page.locator(".supporting-evidence > .tool-evidence").first().locator("summary")).toBeFocused();
    } else await expect(first.getByRole("button")).toHaveCount(0);
    expect(state.posts).toHaveLength(1);
    expect(state.external).toEqual([]);
  });
}
