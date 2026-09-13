import { test, expect, type Page } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createWorker } from "../../server/worker.ts";
import { TEST_ENV } from "../fixtures/provider.ts";
import { labTransport } from "../fixtures/lab-provider.ts";
import { comparePairing } from "../../src/lab/model.ts";
import { contextSegment, labBinding } from "../../src/lab/catalog.ts";
import { parseProject, STORAGE_KEY } from "../../src/composer/project.ts";
import type { Draft } from "../../src/composer/model.ts";
import type { LabResult } from "../../src/lab/contract.ts";

test.use({ video: { mode: "on", size: { width: 1280, height: 900 } } });
const directory = "test-results/context-lab";
const stored = (page: Page): Promise<Draft> =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).draft,
    STORAGE_KEY,
  );
async function fixture(
  page: Page,
  mock = labTransport(),
  hold?: () => Promise<void>,
) {
  const worker = createWorker(mock);
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const response = await worker.fetch(
      new Request(req.url(), {
        method: req.method(),
        headers: req.headers(),
        ...(req.method() === "POST" ? { body: req.postData() } : {}),
      }),
      TEST_ENV,
    );
    if (req.url().endsWith("/api/lab")) await hold?.();
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
  return mock;
}
async function seed(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make my version · 1.wav", exact: true })
    .click();
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    "My first coda",
  );
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const d = await pending;
  const path = await d.path();
  expect(path).toBeTruthy();
  return {
    path: path!,
    bytes: await readFile(path!),
    name: d.suggestedFilename(),
  };
}

test("TEST ONLY connected journey: preserve Composer, hear annotation timing, compare controls, real tool dispatch and delivered investigation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mock = await fixture(page);
  await page.addInitScript(() => {
    const events: { type: string; duration?: number }[] = [];
    Object.assign(window, { __labAudio: events });
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      events.push({ type: "start", duration: this.buffer?.duration });
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      events.push({ type: "stop" });
      return stop.apply(this, args);
    };
  });
  await seed(page);
  const seedDraft = await stored(page);
  await page
    .getByRole("button", { name: "Lengthen ×1.25", exact: true })
    .click();
  await page
    .getByLabel("Phrase title", { exact: true })
    .fill("My preserved Context journey");
  await page.getByLabel("Phrase title", { exact: true }).blur();
  await page
    .getByRole("button", { name: "Save active block to codebook", exact: true })
    .click();
  const savedState = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(savedState.codebook).toHaveLength(1);
  const fieldSelection = await page
    .getByLabel("Select recording B", { exact: true })
    .inputValue();
  const before = await stored(page);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/${info.project.name}-composer-entry.png`,
  });
  await page
    .getByRole("button", { name: "▶ Play my synthetic phrase", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "Playing",
  );
  await page.getByRole("button", { name: "Context Lab", exact: true }).click();
  const lab = page.locator(".context-lab");
  await expect(lab).toBeVisible();
  expect(await stored(page)).toEqual(before);
  expect(mock.calls).toHaveLength(0);
  await expect(page.locator("#composer")).toBeHidden();
  await expect(lab).toContainText("not the original recording");
  await expect(
    lab.getByRole("status").filter({ hasText: "conservative combined gain" }),
  ).toContainText("stopped");
  const timeline = await page.locator(".exchange-timeline").innerHTML();
  await page
    .getByRole("button", { name: "Play annotated timing window", exact: true })
    .click();
  await expect(
    lab.getByRole("status").filter({ hasText: "conservative combined gain" }),
  ).toContainText("Playing");
  expect(
    await page
      .locator("audio")
      .evaluateAll((els) => els.every((el) => (el as HTMLAudioElement).paused)),
  ).toBe(true);
  await page.getByRole("button", { name: "Solo B", exact: true }).click();
  await expect(page.getByLabel("Mute caller A", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("Mute caller B", { exact: true }),
  ).not.toBeChecked();
  await expect(
    lab.getByRole("status").filter({ hasText: "conservative combined gain" }),
  ).toContainText("stopped");
  await page
    .getByRole("button", { name: "Hear both callers", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play annotated timing window", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop reconstruction", exact: true })
    .click();
  const audio = await page.evaluate(
    () =>
      (
        window as unknown as {
          __labAudio: { type: string; duration?: number }[];
        }
      ).__labAudio,
  );
  expect(audio.filter((e) => e.type === "start")).toHaveLength(3);
  expect(audio.filter((e) => e.type === "stop").length).toBeGreaterThanOrEqual(
    3,
  );
  expect(audio.filter((e) => e.type === "start").at(-1)!.duration).toBeCloseTo(
    20.09,
    4,
  );
  await page.getByLabel("Control offset", { exact: true }).selectOption("1");
  const comparison = comparePairing(contextSegment, 1);
  await expect(page.getByTestId("lab-observed")).toHaveText(
    `${comparison.observed.valueSeconds!.toFixed(6)} s`,
  );
  await expect(page.getByTestId("lab-selected-score")).toHaveText(
    `${comparison.selected.valueSeconds!.toFixed(6)} s`,
  );
  expect(await page.locator(".exchange-timeline").innerHTML()).toBe(timeline);
  await page
    .getByRole("button", { name: "Reset to observed", exact: true })
    .click();
  await expect(page.getByTestId("lab-selected-score")).toHaveText(
    `${comparison.observed.valueSeconds!.toFixed(6)} s`,
  );
  await page.getByLabel("Control offset", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Later window", exact: true }).click();
  await page
    .getByLabel("Selected exchange coda", { exact: true })
    .selectOption("row-12");
  await page
    .getByRole("button", { name: "Zoom to selected coda", exact: true })
    .click();
  await expect(page.locator(".lab-selected")).toContainText("row 12");
  expect(mock.calls).toHaveLength(0);
  expect(await stored(page)).toEqual(before);
  await page.screenshot({
    path: `${directory}/${info.project.name}-real-source-lab.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Ask Astra about this comparison",
      exact: true,
    })
    .click();
  const resultBox = page.getByTestId("lab-result");
  await expect(resultBox).toBeVisible();
  await expect(resultBox).toContainText(
    "TEST ONLY · provider transport fixture · no live Astra call",
  );
  await expect(resultBox).toContainText(
    "Generated interpretation · unverified",
  );
  expect(mock.calls).toHaveLength(2);
  const result = JSON.parse(
    (await resultBox.locator("pre").textContent())!,
  ) as LabResult;
  expect(result.binding).toBe(labBinding(1, "row-12"));
  expect(result.comparison).toEqual(comparison);
  expect(result.actions.at(-1)).toMatchObject({
    name: "control_result",
    initiatedBy: "model",
    arguments: { segmentId: contextSegment.id, offset: 1 },
  });
  expect(JSON.stringify(result)).not.toMatch(
    /test-opaque|encrypted_content|TEST_ONLY_NOT_A_CREDENTIAL/,
  );
  const json = await download(page, "Download investigation JSON"),
    card = await download(page, "Download investigation card");
  const packet = JSON.parse(json.bytes.toString());
  expect(packet.generated).toEqual(result);
  expect(packet.comparison).toEqual(comparison);
  expect(packet.segment).toEqual(contextSegment);
  expect(packet.selection.selectedRowId).toBe("row-12");
  expect(packet.savedAnalysisStatus).toContain("Historical");
  expect(json.bytes.length).toBeLessThan(131072);
  expect(card.bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(card.bytes.readUInt32BE(16)).toBe(1200);
  expect(card.bytes.readUInt32BE(20)).toBeLessThan(3200);
  await copyFile(
    card.path,
    `${directory}/${info.project.name}-TEST-ONLY-investigation-card.png`,
  );
  await copyFile(
    json.path,
    `${directory}/${info.project.name}-TEST-ONLY-investigation.json`,
  );
  await resultBox.screenshot({
    path: `${directory}/${info.project.name}-TEST-ONLY-explanation.png`,
  });
  await writeFile(
    `${directory}/${info.project.name}-TEST-ONLY-result.json`,
    JSON.stringify(result, null, 2),
  );
  await page
    .getByRole("button", {
      name: "Return to Composer with my creation",
      exact: true,
    })
    .click();
  expect(await stored(page)).toEqual(before);
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    before.title,
  );
  const afterLab = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(afterLab.codebook).toEqual(savedState.codebook);
  expect(afterLab.activeId).toEqual(savedState.activeId);
  expect(
    await page.getByLabel("Select recording B", { exact: true }).inputValue(),
  ).toBe(fieldSelection);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); // title transaction
  await page.getByRole("button", { name: "Undo", exact: true }).click(); // timing remains in history
  expect((await stored(page)).blocks).toEqual(seedDraft.blocks);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await stored(page)).blocks).toEqual(before.blocks);
  const project = await download(page, "Download project JSON"),
    restored = parseProject(project.bytes.toString());
  expect(restored.draft!.blocks).toEqual(before.blocks);
  await page
    .getByLabel("Open Composer project", { exact: true })
    .setInputFiles(project.path);
  expect((await stored(page)).blocks).toEqual(before.blocks);
  expect(mock.calls).toHaveLength(2);
  expect(errors).toEqual([]);
});

for (const change of ["offset", "row", "question", "navigation"])
  test(`TEST ONLY late Lab response is obsolete after ${change}`, async ({
    page,
  }) => {
    let release = () => {},
      waiting = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mock = await fixture(page, labTransport(), async () => {
      waiting = true;
      await gate;
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Context Lab", exact: true })
      .click();
    await page.getByLabel("Control offset", { exact: true }).selectOption("1");
    await page
      .getByRole("button", {
        name: "Ask Astra about this comparison",
        exact: true,
      })
      .click();
    await expect.poll(() => waiting).toBe(true);
    if (change === "offset")
      await page
        .getByLabel("Control offset", { exact: true })
        .selectOption("2");
    if (change === "row")
      await page
        .getByLabel("Selected exchange coda", { exact: true })
        .selectOption("row-12");
    if (change === "question")
      await page
        .getByLabel("Context question", { exact: true })
        .fill("An updated question");
    if (change === "navigation")
      await page.getByRole("button", { name: "Composer", exact: true }).click();
    release();
    if (change === "navigation")
      await page
        .getByRole("button", { name: "Context Lab", exact: true })
        .click();
    await expect(page.getByTestId("lab-result")).toHaveCount(0);
    const json = await download(page, "Download investigation JSON");
    expect(JSON.parse(json.bytes.toString()).generated).toBeNull();
    expect(mock.calls).toHaveLength(2);
  });

test("ordinary disabled Lab: no model requests/autoplay, untrusted question is plain text, audio failure still permits downloads", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Context Lab", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Ask Astra about this comparison",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Play annotated timing window", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Timing audio could not start" }),
  ).toBeVisible();
  const malicious = "<img src=x onerror=alert(1)>".repeat(15);
  await page.getByLabel("Context question", { exact: true }).fill(malicious);
  expect(await page.locator(".context-lab img").count()).toBe(0);
  const json = await download(page, "Download investigation JSON"),
    card = await download(page, "Download investigation card");
  expect(JSON.parse(json.bytes.toString()).question).toBe(malicious);
  expect(card.bytes.readUInt32BE(20)).toBeLessThan(3200);
  expect(posts).toEqual([]);
});
