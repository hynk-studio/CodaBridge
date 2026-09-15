import { composerView, workspaceView, labView, disclosure } from "./navigation.ts";
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
  const responses: LabResult[] = [];
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
    if (req.url().endsWith("/api/lab")) {
      if (response.ok) responses.push(await response.clone().json() as LabResult);
      await hold?.();
    }
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
  return { ...mock, responses };
}
async function seed(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make my version · 1.wav", exact: true })
    .click();
  await composerView(page, "edit");
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    "My first coda",
  );
}

test("focused follow-up: Lab answer opens once without moving focus or scroll, and failure preserves the comparison", async ({ page }) => {
  let release = () => {}, fail = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const mock = labTransport();
  await fixture(page, {
    ...mock,
    transport: async (url, init) => {
      if (fail) throw new Error("TEST ONLY controlled transport failure");
      return mock.transport(url, init);
    },
  }, () => gate);
  await seed(page);
  const draft = await stored(page);
  await labView(page, "compare");
  await page.getByLabel("Duration assignment", { exact: true }).selectOption("1");
  const measured = await page.locator(".lab-statistics").innerText();
  const question = page.getByRole("textbox", { name: "Context question", exact: true });
  await question.fill("Does the observed pairing look different from reassigned durations, and what remains uncertain?");
  await page.getByRole("button", { name: "Ask Astra", exact: true }).click();
  await expect(page.getByRole("button", { name: "Waiting for Astra…", exact: true })).toBeDisabled();
  await question.click();
  const scrollBefore = await page.evaluate(() => scrollY);
  release();
  const result = page.getByTestId("lab-result"), answer = result.locator(".exact-answer");
  await expect(answer).toHaveAttribute("open");
  await expect(question).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  const received = JSON.parse((await result.locator(".supporting-evidence > pre").textContent())!) as LabResult;
  expect(await answer.locator("p").allTextContents()).toEqual([
    ...received.explanation.possibleInterpretations, ...received.explanation.limitations,
  ].map(row => row.text));
  expect(received.comparison).toEqual(comparePairing(contextSegment, 1));
  await expect(result.locator("details").last()).not.toHaveAttribute("open");
  await answer.locator("summary").click();
  await labView(page, "save");
  await labView(page, "compare");
  await expect(answer).not.toHaveAttribute("open");
  expect(mock.calls).toHaveLength(2);
  await page.getByRole("button", { name: "Ask Astra", exact: true }).click();
  await expect(answer).toHaveAttribute("open");
  fail = true;
  await page.getByRole("button", { name: "Ask Astra", exact: true }).click();
  await expect(page.locator(".lab-ask .lab-notice")).toContainText("The measured comparison is unchanged");
  await expect(page.locator(".lab-ask .lab-notice")).toHaveAttribute("data-tone", "warning");
  await expect(result).toHaveCount(0);
  expect(await page.locator(".lab-statistics").innerText()).toBe(measured);
  expect(await stored(page)).toEqual(draft);
  const packet = await download(page, "Download investigation JSON");
  await expect(page.locator(".lab-notice")).toHaveAttribute("data-tone", "info");
  await expect(page.locator(".lab-notice")).toHaveAttribute("role", "status");
  expect(JSON.parse(packet.bytes.toString()).generated).toBeNull();
  expect(JSON.parse(packet.bytes.toString()).comparison).toEqual(comparePairing(contextSegment, 1));
  await labView(page, "compare");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Ask Astra", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/followup-lab-320-enlarged.png", fullPage: false });
});
async function download(page: Page, name: string) {
  if (name.startsWith("Download investigation")) await labView(page, "save");
  else await composerView(page, "save");
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
  await (await composerView(page, "edit"))
    .getByRole("button", { name: "Lengthen ×1.25", exact: true })
    .click();
  await (await composerView(page, "edit"))
    .getByLabel("Phrase title", { exact: true })
    .fill("My preserved Context journey");
  await page.getByLabel("Phrase title", { exact: true }).blur();
  await (await composerView(page, "save"))
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
  await (await composerView(page, "edit"))
    .getByRole("button", { name: "Play whole phrase", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "Playing",
  );
  await workspaceView(page, "Context Lab");
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
  await (await labView(page, "explore"))
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
  await (await labView(page, "explore")).getByRole("button", { name: "Solo B", exact: true }).click();
  await expect(page.getByLabel("Mute caller A", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("Mute caller B", { exact: true }),
  ).not.toBeChecked();
  await expect(
    lab.getByRole("status").filter({ hasText: "conservative combined gain" }),
  ).toContainText("stopped");
  await (await labView(page, "explore"))
    .getByRole("button", { name: "Hear both callers", exact: true })
    .click();
  await (await labView(page, "explore"))
    .getByRole("button", { name: "Play annotated timing window", exact: true })
    .click();
  await (await labView(page, "explore"))
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
  await (await labView(page, "compare")).getByLabel("Duration assignment", { exact: true }).selectOption("1");
  const comparison = comparePairing(contextSegment, 1);
  await expect(page.getByTestId("lab-observed")).toHaveText(
    `${comparison.observed.valueSeconds!.toFixed(3)} s`,
  );
  await expect(page.getByTestId("lab-selected-score")).toHaveText(
    `${comparison.selected.valueSeconds!.toFixed(3)} s`,
  );
  expect(await page.locator(".exchange-timeline").innerHTML()).toBe(timeline);
  await (await labView(page, "compare"))
    .getByRole("button", { name: "Reset to observed", exact: true })
    .click();
  await expect(page.getByTestId("lab-selected-score")).toHaveText(
    `${comparison.observed.valueSeconds!.toFixed(3)} s`,
  );
  await (await labView(page, "compare")).getByLabel("Duration assignment", { exact: true }).selectOption("1");
  await (await labView(page, "explore")).getByRole("button", { name: "Later window", exact: true }).click();
  await (await labView(page, "explore"))
    .getByLabel("Selected exchange coda", { exact: true })
    .selectOption("row-12");
  await (await labView(page, "explore"))
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
  await (await labView(page, "compare"))
    .getByRole("button", {
      name: "Ask Astra",
      exact: true,
    })
    .click();
  const resultBox = page.getByTestId("lab-result");
  await expect(resultBox).toBeVisible();
  await expect(resultBox).toContainText(
    "TEST ONLY · provider transport fixture · no live Astra call",
  );
  await expect(resultBox).toContainText(
    "Exact generated answer · unverified",
  );
  expect(mock.calls).toHaveLength(2);
  const result = mock.responses.at(-1)!;
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
  await labView(page, "compare");
  await disclosure(page, ".lab-result .exact-answer");
  await resultBox.screenshot({
    path: `${directory}/${info.project.name}-TEST-ONLY-explanation.png`,
  });
  await writeFile(
    `${directory}/${info.project.name}-TEST-ONLY-result.json`,
    JSON.stringify(result, null, 2),
  );
  await (await labView(page, "save"))
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
  await (await composerView(page, "edit")).getByRole("button", { name: "Undo", exact: true }).click(); // title transaction
  await (await composerView(page, "edit")).getByRole("button", { name: "Undo", exact: true }).click(); // timing remains in history
  expect((await stored(page)).blocks).toEqual(seedDraft.blocks);
  await (await composerView(page, "edit")).getByRole("button", { name: "Redo", exact: true }).click();
  await (await composerView(page, "edit")).getByRole("button", { name: "Redo", exact: true }).click();
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
    await workspaceView(page, "Context Lab");
    await (await labView(page, "compare")).getByLabel("Duration assignment", { exact: true }).selectOption("1");
    await (await labView(page, "compare"))
      .getByRole("button", {
        name: "Ask Astra",
        exact: true,
      })
      .click();
    await expect.poll(() => waiting).toBe(true);
    if (change === "offset")
      await (await labView(page, "compare"))
        .getByLabel("Duration assignment", { exact: true })
        .selectOption("2");
    if (change === "row")
      await (await labView(page, "explore"))
        .getByLabel("Selected exchange coda", { exact: true })
        .selectOption("row-12");
    if (change === "question")
      await (await labView(page, "compare"))
        .getByLabel("Context question", { exact: true })
        .fill("An updated question");
    if (change === "navigation")
      await workspaceView(page, "Composer");
    release();
    if (change === "navigation")
      await workspaceView(page, "Context Lab");
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
  await workspaceView(page, "Context Lab");
  await labView(page, "compare");
  await expect(
    page.getByRole("button", {
      name: "Ask Astra",
      exact: true,
    }),
  ).toBeDisabled();
  await (await labView(page, "explore"))
    .getByRole("button", { name: "Play annotated timing window", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Timing audio could not start" }),
  ).toBeVisible();
  const malicious = "<img src=x onerror=alert(1)>".repeat(15);
  await (await labView(page, "compare")).getByLabel("Context question", { exact: true }).fill(malicious);
  expect(await page.locator(".context-lab img").count()).toBe(0);
  const json = await download(page, "Download investigation JSON"),
    card = await download(page, "Download investigation card");
  expect(JSON.parse(json.bytes.toString()).question).toBe(malicious);
  expect(card.bytes.readUInt32BE(20)).toBeLessThan(3200);
  expect(posts).toEqual([]);
});
