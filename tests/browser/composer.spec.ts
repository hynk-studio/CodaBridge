import { test, expect, type Page } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createWorker } from "../../server/worker.ts";
import {
  composerTransport,
  modifiedCopyInput,
  QUANTITATIVE_COMPOSER_PROSE,
  INCORRECT_COMPOSER_PROSE,
} from "../fixtures/composer-provider.ts";
import {
  TEST_ENV,
  finalOutput,
  scriptedTransport,
} from "../fixtures/provider.ts";
import type { ProviderTransport } from "../../server/provider.ts";
import {
  parseProject,
  projectJson,
  STORAGE_KEY,
  creationEvidence,
} from "../../src/composer/project.ts";
import { createDraft, type Draft } from "../../src/composer/model.ts";
import type { ComposerResult } from "../../src/composer/contract.ts";
import { recordings } from "../../src/domain/catalog.ts";
import { eventSchedule, RENDERER } from "../../src/composer/sound.ts";

// Ordinary reruns must never overwrite committed historical verification media.
const outputDirectory = "test-results/composer-review";
test.use({ video: { mode: "on", size: { width: 1280, height: 900 } } });
async function seed(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make my version · 1.wav", exact: true })
    .click();
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    "My first coda",
  );
}
async function storedDraft(page: Page): Promise<Draft> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).draft,
    STORAGE_KEY,
  );
}
async function routeFixture(
  page: Page,
  transport: ProviderTransport,
  onResult?: (response: Response) => void,
) {
  const worker = createWorker({ transport });
  await page.route("**/api/**", async (route) => {
    const input = route.request();
    const response = await worker.fetch(
      new Request(input.url(), {
        method: input.method(),
        headers: input.headers(),
        ...(input.method() === "POST" ? { body: input.postData() } : {}),
      }),
      TEST_ENV,
    );
    if (input.url().endsWith("/api/composer")) onResult?.(response);
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
}

async function modifiedCopy(page: Page) {
  await seed(page);
  await page
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Scale duration", exact: true })
    .click();
  await page.locator(".gap-editor summary").click();
  await page.getByLabel("Gap 1 → 2", { exact: true }).fill("0.300");
  await page.getByLabel("Gap 1 → 2", { exact: true }).press("Enter");
  const draft = await storedDraft(page);
  expect(draft.blocks.map((b) => b.times)).toEqual(
    modifiedCopyInput().draft.blocks.map((b) => b.times),
  );
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .selectOption("investigate");
  await page
    .getByRole("textbox", { name: "Your request", exact: true })
    .fill(
      "Find the closest real recordings to my currently selected edited block under the normalized interval metric. Exclude its seed and explain the timing differences and limitations.",
    );
  return draft;
}

for (const [label, prose] of [
  ["supported", QUANTITATIVE_COMPOSER_PROSE],
  ["incorrect-limitation", INCORRECT_COMPOSER_PROSE],
])
  test(`TEST ONLY numeric Composer prose ${label}: tool loop, unverified UI and separate downloaded evidence`, async ({
    page,
  }, info) => {
    const mock = composerTransport("scale", prose),
      catalogBefore = structuredClone(recordings);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await routeFixture(page, mock.transport);
    const before = await modifiedCopy(page),
      activeId = before.blocks[1].id;
    const facts = creationEvidence(before, activeId);
    const comparison = page.getByRole("region", {
      name: "Compare my creation",
      exact: true,
    });
    const comparisonBefore = await comparison.innerText();
    const fieldSelection = await page
      .getByLabel("Select recording B", { exact: true })
      .inputValue();
    await page
      .getByRole("button", { name: "Ask Astra to investigate", exact: true })
      .click();
    const visible = page.getByTestId("composer-result");
    await expect(visible).toContainText(
      "TEST ONLY · model transport fixture · no live Astra call",
    );
    await expect(visible.getByRole("heading")).toHaveText(
      "Generated interpretation · unverified",
    );
    await expect(visible).toContainText(prose);
    await expect(visible.getByRole("heading")).not.toContainText(
      /fact.?verified/i,
    );
    const result = JSON.parse(
      (await visible.locator("pre").textContent())!,
    ) as ComposerResult;
    expect(result.proposal).toBeNull();
    expect(result.analysis.blockId).toBe(activeId);
    expect(result.analysis.matches).toEqual(facts.analysis.matches);
    expect(result.analysis.eligibleCount).toBe(2);
    expect(result.actions.at(-1)).toMatchObject({
      name: "find_creation_alternatives",
      initiatedBy: "model",
      arguments: { blockId: activeId, limit: 3 },
    });
    expect(mock.calls).toHaveLength(2);
    expect(JSON.stringify(mock.calls[1].payload.input)).toContain(
      "function_call_output",
    );
    expect(await storedDraft(page)).toEqual(before);
    expect(await comparison.innerText()).toBe(comparisonBefore);
    expect(
      await page.getByLabel("Select recording B", { exact: true }).inputValue(),
    ).toBe(fieldSelection);
    await expect(comparison).not.toContainText("dswp-99");
    await expect(
      page.getByRole("button", { name: "Apply proposal", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Include analysis evidence", { exact: false })
      .check();
    const delivered = await download(page, "Download project JSON");
    expect(delivered.filename).toContain(`r${before.revision}-project.json`);
    const project = parseProject(delivered.bytes.toString());
    const saved = project.savedAnalysis as {
      label: string;
      deterministic: unknown;
      generated: ComposerResult;
    };
    expect(saved.label).toBe("Saved analysis — unverified on reopen");
    expect(saved.deterministic).toEqual(facts);
    expect(saved.generated).toEqual(result);
    expect(project.draft).toEqual(before);
    expect(project.activeId).toBe(activeId);
    expect(project.credits).toEqual(
      parseProject(projectJson(before, [])).credits,
    );
    expect(recordings).toEqual(catalogBefore);
    expect(JSON.stringify(project)).not.toMatch(
      /test-opaque|encrypted_content|TEST_ONLY_NOT_A_CREDENTIAL|fact-verified/,
    );
    const directory = "test-results/composer-numeric-prose";
    await mkdir(directory, { recursive: true });
    await visible.screenshot({
      path: `${directory}/${info.project.name}-TEST-ONLY-${label}.png`,
    });
    await copyFile(
      delivered.path,
      `${directory}/${info.project.name}-TEST-ONLY-${label}-project.json`,
    );
    await page
      .getByLabel("Open Composer project", { exact: true })
      .setInputFiles(delivered.path);
    await expect(
      page.getByText(
        "Imported / saved analysis · unverified historical content",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(visible).toHaveCount(0);
    expect((await storedDraft(page)).blocks).toEqual(before.blocks);
    expect(mock.calls).toHaveLength(2);
    expect(errors).toEqual([]);
  });

test("late TEST ONLY numeric Composer investigation cannot describe or enter the export of a changed draft", async ({
  page,
}) => {
  const mock = composerTransport("scale", QUANTITATIVE_COMPOSER_PROSE);
  let release: () => void = () => {},
    finalWaiting = false,
    serverAccepted = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await routeFixture(
    page,
    async (url, init) => {
      const output = await mock.transport(url, init);
      if (mock.calls.length === 2) {
        finalWaiting = true;
        await gate;
      }
      return output;
    },
    (response) => {
      serverAccepted = response.status === 200;
    },
  );
  const before = await modifiedCopy(page);
  await page
    .getByRole("button", { name: "Ask Astra to investigate", exact: true })
    .click();
  await expect.poll(() => finalWaiting).toBe(true);
  await page.getByLabel("Gap 1 → 2", { exact: true }).fill("0.350");
  await page.getByLabel("Gap 1 → 2", { exact: true }).press("Enter");
  const changed = await storedDraft(page);
  expect(changed.revision).toBeGreaterThan(before.revision);
  expect(changed.blocks[1].times[1]).toBe(0.35);
  release();
  await expect.poll(() => serverAccepted).toBe(true);
  await expect(page.getByTestId("composer-result")).toHaveCount(0);
  await page.getByLabel("Include analysis evidence", { exact: false }).check();
  const delivered = await download(page, "Download project JSON");
  const project = parseProject(delivered.bytes.toString());
  expect(project.draft).toEqual(changed);
  expect(project.savedAnalysis).toMatchObject({
    generated: null,
    deterministic: creationEvidence(changed, changed.blocks[1].id),
  });
  expect(delivered.bytes.toString()).not.toContain(QUANTITATIVE_COMPOSER_PROSE);
  expect(mock.calls).toHaveLength(2);
});
async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const delivered = await pending,
    path = await delivered.path();
  expect(path).not.toBeNull();
  expect(await delivered.failure()).toBeNull();
  return {
    path: path!,
    filename: delivered.suggestedFilename(),
    bytes: await readFile(path!),
  };
}

for (const field of ["Phrase title", "My intention", "Meaning I assign"]) {
  const investigation = field === "My intention";
  test(`sequential ${field} typing is one undo transaction and rejects a pending TEST ONLY ${investigation ? "investigation" : "proposal"}`, async ({
    page,
  }) => {
    const mock = composerTransport();
    let release: () => void = () => {},
      started = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await routeFixture(page, async (url, init) => {
      started = true;
      await gate;
      return mock.transport(url, init);
    });
    await seed(page);
    const original = await storedDraft(page);
    await page
      .getByRole("button", { name: "Lengthen ×1.25", exact: true })
      .click();
    const timed = await storedDraft(page);
    if (investigation)
      await page
        .getByLabel("What would you like to do?", { exact: true })
        .selectOption("investigate");
    await page
      .getByRole("button", {
        name: investigation
          ? "Ask Astra to investigate"
          : "Ask Astra for an edit",
        exact: true,
      })
      .click();
    await expect.poll(() => started).toBe(true);
    const input = page.getByLabel(field, { exact: field === "Phrase title" });
    const oldText = await input.inputValue();
    await input.focus();
    await input.press("End");
    const text =
      " A thoughtful pause before another small answer in my own code.";
    expect(text.length).toBeGreaterThan(40);
    // Key-by-key input (not fill), with an assertion before blur / transaction close.
    await input.pressSequentially(text[0]);
    await expect(
      page.getByRole("button", { name: "Working with this revision…" }),
    ).toHaveCount(0);
    await expect(input).toBeFocused();
    await input.pressSequentially(text.slice(1));
    await expect(input).toHaveValue(oldText + text);
    const typed = await storedDraft(page);
    expect(typed.revision).toBe(timed.revision + text.length);
    expect(typed.blocks[0].times).toEqual(timed.blocks[0].times);
    await input.press("Tab"); // End this text transaction.
    release();
    await expect.poll(() => mock.calls.length).toBe(investigation ? 2 : 1);
    await expect(page.getByTestId("composer-result")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(input).toHaveValue(oldText);
    expect((await storedDraft(page)).blocks).toEqual(timed.blocks);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await storedDraft(page)).blocks).toEqual(original.blocks);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(input).toHaveValue(oldText + text);
    const redone = await storedDraft(page);
    expect(redone.blocks).toEqual(typed.blocks);
    expect(redone.revision).toBeGreaterThan(typed.revision);
    await page.reload();
    expect(await storedDraft(page)).toEqual(redone);
    await expect(input).toHaveValue(oldText + text);
    await expect(page.getByTestId("composer-result")).toHaveCount(0);
    expect(mock.calls).toHaveLength(investigation ? 2 : 1);
  });
}

test("entry navigation preserves a draft and the secondary download is explicitly A/B evidence", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await seed(page);
  await page
    .getByLabel("Phrase title", { exact: true })
    .fill("Keep this draft");
  await page
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  const saved = await storedDraft(page);
  await page.reload();
  await page
    .getByRole("link", { name: "Listen to recordings ↓", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open my Composer →", exact: true })
    .click();
  expect(await storedDraft(page)).toEqual(saved);
  expect(
    await page
      .locator("audio")
      .evaluateAll((els) => els.every((el) => (el as HTMLAudioElement).paused)),
  ).toBe(true);
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  await page.locator(".evidence-panel summary").click();
  await expect(page.locator(".evidence-panel")).toContainText(
    "This is not a Composer project",
  );
  const file = await download(page, "Download recording-comparison JSON");
  const evidence = JSON.parse(file.bytes.toString());
  expect(
    evidence.selection.map((s: { sourceId: string }) => s.sourceId),
  ).toEqual(["dswp-1", "dswp-2"]);
  expect(evidence.format).not.toBe("codabridge-project");
  expect(await storedDraft(page)).toEqual(saved);
  expect(posts).toEqual([]);
});

test("selected-block audition uses its own schedule, coordinates playback, and quick edits explain the timing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const starts: number[] = [];
    Object.assign(window, { __testAuditions: starts });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      starts.push(this.buffer!.duration);
      return start.apply(this, args);
    };
  });
  await seed(page);
  await page
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lengthen ×1.25", exact: true })
    .press("Enter");
  const draft = await storedDraft(page),
    block = draft.blocks[1];
  await expect(page.getByTestId("timing-change")).toContainText(
    "relative spacing is unchanged",
  );
  await expect(page.getByTestId("creation-seed-score")).toHaveText("0.000000");
  await page.getByLabel("Duration multiplier", { exact: true }).fill("1.5");
  await expect(page.locator(".number-hint")).toHaveText(
    "×1.5 multiplies every gap by 1.5. Normalized spacing stays the same.",
  );
  const auditions = () =>
    page.evaluate(
      () =>
        (window as unknown as { __testAuditions: number[] }).__testAuditions,
    );
  for (const [index, name] of [
    "Play synthetic seed timing",
    "Play selected synthetic block",
    "▶ Play my synthetic phrase",
  ].entries()) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect.poll(async () => (await auditions()).length).toBe(index + 1);
  }
  const durations = await auditions();
  expect(durations[0]).toBeCloseTo(draft.blocks[0].times.at(-1)! + 0.09, 4);
  expect(durations[1]).toBeCloseTo(block.times.at(-1)! + 0.09, 4);
  expect(durations[2]).toBeCloseTo(eventSchedule(draft).duration, 4);
  await page
    .getByRole("button", { name: "Open first gap +0.05 s", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  await expect(page.getByTestId("timing-change")).toContainText(
    "different proportions",
  );
  await expect(page.getByTestId("creation-seed-score")).not.toHaveText(
    "0.000000",
  );
  const after = (await storedDraft(page)).blocks[1];
  expect(after.times[1]).toBeCloseTo(block.times[1] + 0.05, 12);
  for (let i = 2; i < after.times.length; i++)
    expect(after.times[i] - after.times[i - 1]).toBeCloseTo(
      block.times[i] - block.times[i - 1],
      12,
    );
  await page
    .getByRole("button", { name: "Play selected synthetic block", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  await page
    .getByRole("button", { name: "Play selected synthetic block", exact: true })
    .click();
  expect(
    await page
      .locator("audio")
      .evaluateAll((els) => els.every((el) => (el as HTMLAudioElement).paused)),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Pause synthetic", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "paused",
  );
  await page
    .getByRole("button", { name: "Resume synthetic", exact: true })
    .click();
  await page.locator(".phrase-block").first().click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
});

test("local complete journey: field audio, independent edits, playback, comparison, codebook and real downloads", async ({
  page,
}, info) => {
  const external: string[] = [],
    modelCalls: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4173") &&
      !/^(blob:|data:)/.test(request.url())
    )
      external.push(request.url());
    if (request.method() === "POST" && request.url().includes("/api/"))
      modelCalls.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const rows: { text: string; font: string }[] = [];
    Object.assign(window, { __testCardRows: rows });
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      rows.push({ text: args[0], font: this.font });
      return fill.apply(this, args);
    };
  });
  await page.goto("/");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await expect(
    page.getByRole("navigation", { name: "Listen and create" }),
  ).toBeVisible();
  await expect(page.locator(".intro")).not.toContainText("Download");
  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({
    path: `${outputDirectory}/${info.project.name}-listen.png`,
  });
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Playback status A")).toHaveText("Playing");
  await page
    .getByLabel("My listening impression")
    .fill("An uneven pattern with space to breathe");
  await page
    .getByRole("button", { name: "Reveal measurements", exact: true })
    .click();
  await expect(page.getByTestId("metric-value")).toBeVisible();
  await expect(page.locator(".interval-details")).not.toHaveAttribute("open");
  await page
    .getByRole("button", { name: "Make my version · 1.wav", exact: true })
    .click();
  const original = await storedDraft(page);
  await page
    .getByLabel("Phrase title", { exact: true })
    .fill("Room to breathe");
  await page
    .getByLabel("My intention", { exact: false })
    .fill("A pause before answering — my own human code");
  await page
    .getByLabel("Meaning I assign", { exact: false })
    .fill("A little hello");
  await page
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Scale duration", exact: true })
    .click();
  const scaled = await storedDraft(page);
  expect(scaled.blocks).toHaveLength(2);
  expect(scaled.blocks[0].times).toEqual(original.blocks[0].times);
  expect(scaled.blocks[1].times.at(-1)).toBeCloseTo(
    original.blocks[0].times.at(-1)! * 1.25,
    12,
  );
  await expect(page.getByTestId("creation-seed-score")).toHaveText("0.000000");
  await page
    .getByRole("button", { name: "▶ Play my synthetic phrase", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "Playing synthetic clicks",
  );
  expect(
    await page
      .locator("audio")
      .evaluateAll((elements) =>
        elements.every((element) => (element as HTMLAudioElement).paused),
      ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Pause synthetic", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "paused",
  );
  await page
    .getByRole("button", { name: "Resume synthetic", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop synthetic", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  await expect(page.locator(".gap-editor")).not.toHaveAttribute("open");
  await page.locator(".gap-editor summary").click();
  await page.getByLabel("Gap 1 → 2", { exact: true }).fill("0.3");
  await page.getByLabel("Gap 1 → 2", { exact: true }).press("Enter");
  const changed = await storedDraft(page);
  expect(changed.blocks[1].times[1]).toBe(0.3);
  expect(changed.blocks[0].times).toEqual(original.blocks[0].times);
  await expect(page.getByTestId("creation-seed-score")).not.toHaveText(
    "0.000000",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await storedDraft(page)).blocks).toEqual(scaled.blocks);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await storedDraft(page)).blocks).toEqual(changed.blocks);
  await page
    .getByRole("button", { name: "Listen / compare dswp-11", exact: true })
    .click();
  await expect(
    page.getByLabel("Select recording B", { exact: true }),
  ).toHaveValue("dswp-11");
  await expect(page.getByLabel("Playback status B")).toHaveText(
    "Ready · source bytes checked",
  );
  expect((await storedDraft(page)).blocks).toEqual(changed.blocks);
  expect(
    await page
      .locator("audio")
      .evaluateAll((elements) =>
        elements.every((element) => (element as HTMLAudioElement).paused),
      ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save active block to codebook", exact: true })
    .click();
  await expect(
    page.getByLabel("Include analysis evidence", { exact: false }),
  ).not.toBeChecked();
  const current = await storedDraft(page);
  await page.locator(".composer-workbench").screenshot({
    path: `${outputDirectory}/${info.project.name}-workbench.png`,
  });
  const wav = await download(page, "Download synthetic WAV"),
    card = await download(page, "Download card image"),
    project = await download(page, "Download project JSON");
  for (const file of [wav, card, project])
    expect(file.filename).toContain(`-r${current.revision}`);
  expect(wav.filename).toContain("synthetic-timing");
  expect(card.bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(card.bytes.readUInt32BE(16)).toBe(1200);
  expect(card.bytes.readUInt32BE(20)).toBeGreaterThan(700);
  const restored = parseProject(project.bytes.toString("utf8"));
  expect(restored.draft).toEqual(current);
  expect(restored.activeId).toBe(current.blocks[1].id);
  expect(restored.codebook[0].meaning).toBe("A little hello");
  expect(project.bytes.toString()).toContain("CC BY 4.0");
  expect(project.bytes.toString()).toContain("synthetic timing sonification");
  const evidence = restored.savedAnalysis as {
    deterministic: { draft: Draft; analysis: { metric: unknown } };
    generated: unknown;
  };
  expect(evidence.deterministic.draft).toEqual(current);
  expect(evidence.deterministic.analysis).toBeTruthy();
  expect(evidence.generated).toBeNull();
  const rows = await page.evaluate(
    () =>
      (
        window as unknown as {
          __testCardRows: { text: string; font: string }[];
        }
      ).__testCardRows,
  );
  const cardText = rows.map((row) => row.text).join(" ");
  for (const label of [
    current.title,
    current.intention,
    "A little hello",
    "Human-created",
    "synthetic timing sonification",
    "Meaning to sperm whales: unknown",
    "DSWP",
    "CC BY 4.0",
    `Revision ${current.revision}`,
    "This image is not playable",
  ])
    expect(cardText).toContain(label);
  expect(rows.find((row) => row.text === current.title)?.font).toContain(
    "64px",
  );
  expect(cardText).not.toContain("MAD v1.0.0");
  // Decode the delivered WAV in the actual browser, not just the RIFF header.
  const decoded = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const context = new AudioContext({ sampleRate: 48000 });
    try {
      const buffer = await context.decodeAudioData(bytes.buffer);
      const samples = buffer.getChannelData(0);
      let peak = 0;
      for (const v of samples) peak = Math.max(peak, Math.abs(v));
      return {
        duration: buffer.duration,
        rate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        peak,
      };
    } finally {
      await context.close();
    }
  }, wav.bytes.toString("base64"));
  expect(decoded.rate).toBe(48000);
  expect(decoded.channels).toBe(1);
  expect(decoded.peak).toBeGreaterThan(0);
  expect(decoded.peak).toBeLessThan(RENDERER.gain);
  expect(decoded.duration).toBeCloseTo(eventSchedule(current).duration, 4);
  await mkdir(outputDirectory, { recursive: true });
  await page.locator("#composer").screenshot({
    path: `${outputDirectory}/${info.project.name}-local-composer.png`,
  });
  if (info.project.name === "desktop-chromium") {
    for (const [file, name] of [
      [wav, "creation-synthetic-timing.wav"],
      [card, "creation-card.png"],
      [project, "creation-project.json"],
    ] as const)
      await copyFile(file.path, `${outputDirectory}/${name}`);
    await writeFile(
      `${outputDirectory}/download-verification.json`,
      JSON.stringify(
        {
          kind: "ACTUAL LOCAL BROWSER DOWNLOADS — no model calls",
          revision: current.revision,
          delivered: [wav.filename, card.filename, project.filename],
          wav: decoded,
          projectRestored: true,
        },
        null,
        2,
      ),
    );
  }
  await page
    .getByLabel("Phrase title", { exact: true })
    .fill("An obsolete local edit");
  await page
    .getByLabel("Open Composer project", { exact: true })
    .setInputFiles(project.path);
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    "Room to breathe",
  );
  expect((await storedDraft(page)).blocks).toEqual(current.blocks);
  await expect(
    page.getByRole("heading", { name: "Shape block 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Imported / saved analysis · unverified historical content",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask Astra for an edit", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Start a new phrase", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: /Reuse saved block 1:/ }).click();
  await expect(
    page.getByLabel("Meaning I assign", { exact: false }),
  ).toHaveValue("A little hello");
  expect(external).toEqual([]);
  expect(modelCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("TEST ONLY running-app co-edit and model-requested retrieval demonstration", async ({
  page,
}, info) => {
  const mock = composerTransport("duplicate-scale");
  await routeFixture(page, mock.transport);
  // Capture-only pacing and overlay. Neither is shipped or changes app behavior.
  const holdForCapture = async (milliseconds = 1200) => {
    if (info.project.name === "desktop-chromium")
      await page.waitForTimeout(milliseconds);
  };
  await page.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const badge = document.createElement("div");
      badge.textContent =
        "TEST ONLY · provider transport fixtures · no live Astra call";
      badge.style.cssText =
        "position:fixed;top:0;right:0;z-index:9999;background:#f5d89f;color:#17241b;padding:6px 12px;font:14px sans-serif;pointer-events:none;max-width:100%";
      document.body.append(badge);
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .click();
  await holdForCapture(1500);
  await page
    .getByRole("button", { name: "Make my version · 1.wav", exact: true })
    .click();
  await page.getByLabel("Phrase title", { exact: true }).fill("A longer hello");
  await page
    .getByLabel("Meaning I assign", { exact: false })
    .fill("Hello, in my own code");
  await page
    .getByRole("textbox", { name: "Your request", exact: true })
    .fill("Repeat it and make the second block 1.25 times as long.");
  await holdForCapture();
  const before = await storedDraft(page);
  await page
    .getByRole("button", { name: "Ask Astra for an edit", exact: true })
    .click();
  await expect(page.getByTestId("composer-result")).toContainText("TEST ONLY");
  await expect(page.getByTestId("composer-result")).toContainText(
    "Proposed edit · your draft is unchanged",
  );
  expect(await storedDraft(page)).toEqual(before);
  expect(mock.calls).toHaveLength(1);
  const steps = page.getByRole("list", { name: "Proposed operations" });
  await expect(steps).toContainText(
    "Duplicate Block 1 (position 1) → New block 2 at position 2",
  );
  await expect(steps).toContainText("Scale New block 2 (position 2) ×1.25");
  await expect(steps).not.toContainText(/block 0/i);
  const proposal = JSON.parse(
    (await page.getByTestId("composer-result").locator("pre").textContent())!,
  ).proposal;
  expect(proposal.preview.blocks[0]).toEqual(before.blocks[0]);
  expect(proposal.preview.blocks[1].times.at(-1)).toBeCloseTo(
    before.blocks[0].times.at(-1)! * 1.25,
    12,
  );
  await holdForCapture(2000);
  await page
    .getByRole("button", { name: "Play synthetic proposal", exact: true })
    .click();
  await holdForCapture(1500);
  await page
    .getByRole("button", { name: "Stop synthetic", exact: true })
    .click();
  await page.getByTestId("composer-result").screenshot({
    path: `${outputDirectory}/${info.project.name}-TEST-ONLY-proposal.png`,
  });
  await page
    .getByRole("button", { name: "Apply proposal", exact: true })
    .click();
  expect((await storedDraft(page)).blocks[1].times.at(-1)).toBeCloseTo(
    before.blocks[0].times.at(-1)! * 1.25,
    12,
  );
  expect((await storedDraft(page)).blocks[0]).toEqual(before.blocks[0]);
  await holdForCapture();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await storedDraft(page)).blocks).toEqual(before.blocks);
  await holdForCapture();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.locator(".phrase-block").last().click();
  await page.locator(".gap-editor summary").click();
  await page.getByLabel("Gap 1 → 2", { exact: true }).fill("0.3");
  await page.getByLabel("Gap 1 → 2", { exact: true }).press("Enter");
  await holdForCapture();
  await page
    .getByLabel("What would you like to do?", { exact: true })
    .selectOption("investigate");
  await page
    .getByRole("button", { name: "Ask Astra to investigate", exact: true })
    .click();
  await expect(page.getByTestId("composer-result")).toContainText(
    "Generated interpretation · unverified",
  );
  expect(mock.calls).toHaveLength(3);
  await holdForCapture(2400);
  const result = JSON.parse(
    (await page.getByTestId("composer-result").locator("pre").textContent()) ??
      "{}",
  );
  expect(
    result.actions.map((a: { initiatedBy: string }) => a.initiatedBy),
  ).toEqual(["server", "model"]);
  expect(result.actions[1].name).toBe("find_creation_alternatives");
  expect(
    result.evidence.some((e: { id: string }) => e.id === "source:dswp-11"),
  ).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /test-opaque|intermediate commentary|encrypted_content/,
  );
  await page.getByTestId("composer-result").screenshot({
    path: `${outputDirectory}/${info.project.name}-TEST-ONLY-retrieval.png`,
  });
  await page.getByLabel("Include analysis evidence", { exact: false }).check();
  const project = await download(page, "Download project JSON");
  expect(
    JSON.parse(project.bytes.toString()).savedAnalysis.generated.execution,
  ).toBe("mock-transport-test");
  await page
    .getByRole("button", { name: "Listen / compare dswp-11", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play recording B", exact: true })
    .click();
  await holdForCapture(1300);
  await page.getByTestId("coda-card").scrollIntoViewIfNeeded();
  await holdForCapture(1700);
  expect(mock.calls).toHaveLength(3);
  if (info.project.name === "desktop-chromium") {
    await writeFile(
      `${outputDirectory}/TEST-ONLY-composer-result.json`,
      JSON.stringify(result, null, 2),
    );
    const video = page.video();
    await page.close();
    if (video)
      await video.saveAs(`${outputDirectory}/TEST-ONLY-running-app.webm`);
  }
});

for (const mutation of [
  "edit",
  "undo",
  "block selection",
  "field selection",
  "import",
])
  test(`late TEST ONLY proposal is discarded after ${mutation}`, async ({
    page,
  }) => {
    const mock = composerTransport();
    let release: () => void = () => {},
      started = false;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await routeFixture(page, async (url, init) => {
      started = true;
      await gate;
      return mock.transport(url, init);
    });
    await seed(page);
    await page
      .getByRole("button", { name: "Duplicate block", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ask Astra for an edit", exact: true })
      .click();
    await expect.poll(() => started).toBe(true);
    if (mutation === "edit")
      await page
        .getByRole("button", { name: "Scale duration", exact: true })
        .click();
    else if (mutation === "undo")
      await page.getByRole("button", { name: "Undo", exact: true }).click();
    else if (mutation === "block selection")
      await page.locator(".phrase-block").first().click();
    else if (mutation === "field selection")
      await page
        .getByLabel("Select recording B", { exact: true })
        .selectOption("dswp-7");
    else {
      const draft = createDraft("dswp-2");
      draft.title = "Imported phrase";
      await page
        .getByLabel("Open Composer project", { exact: true })
        .setInputFiles({
          name: "project.json",
          mimeType: "application/json",
          buffer: Buffer.from(projectJson(draft, [])),
        });
      await expect(
        page.getByLabel("Phrase title", { exact: true }),
      ).toHaveValue("Imported phrase");
    }
    const current = await storedDraft(page);
    release();
    await expect.poll(() => mock.calls.length).toBe(1);
    await expect(page.getByTestId("composer-result")).toHaveCount(0);
    expect(await storedDraft(page)).toEqual(current);
  });

test("invalid TEST ONLY proposal and untrusted imports cannot alter the current draft or execute text", async ({
  page,
}) => {
  const mock = scriptedTransport([
    finalOutput({
      revision: 0,
      operations: [{ op: "execute_code", code: "evil" }],
    }),
  ]);
  await routeFixture(page, mock.transport);
  await seed(page);
  const original = await storedDraft(page);
  await page
    .getByRole("button", { name: "Ask Astra for an edit", exact: true })
    .click();
  await expect(page.locator(".composer-notice")).toContainText(
    "could not be accepted",
  );
  expect(await storedDraft(page)).toEqual(original);
  const draft = createDraft("dswp-1");
  draft.title = "<img src='https://bad.invalid' onerror='evil()'>";
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("bad.invalid")) external.push(r.url());
  });
  await page
    .getByLabel("Open Composer project", { exact: true })
    .setInputFiles({
      name: "text.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        projectJson(draft, [], {
          origin: "live",
          explanation: "<script>evil()</script>",
        }),
      ),
    });
  await expect(page.getByLabel("Phrase title", { exact: true })).toHaveValue(
    draft.title,
  );
  await expect(page.getByTestId("coda-card").locator("img,script")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("composer-result")).toHaveCount(0);
  const valid = await storedDraft(page),
    forged = JSON.parse(projectJson(draft, []));
  forged.draft.blocks[0].seed.recordingId = "https://bad.invalid";
  await page
    .getByLabel("Open Composer project", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(forged)),
    });
  await expect(page.locator(".composer-notice")).toContainText(
    "Source reference",
  );
  expect(await storedDraft(page)).toEqual(valid);
  expect(external).toEqual([]);
  expect(mock.calls).toHaveLength(1);
});

test("audio and storage failure leave a keyboard-editable, exportable phrase", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined });
    Storage.prototype.setItem = () => {
      throw new DOMException("Test quota fault", "QuotaExceededError");
    };
  });
  await seed(page);
  await page
    .getByRole("button", { name: "▶ Play my synthetic phrase", exact: true })
    .click();
  await expect(page.locator(".composer-notice")).toContainText(
    "Synthetic audio is unavailable",
  );
  await expect(page.locator(".composer-storage")).toContainText(
    "Local saving failed",
  );
  await page
    .getByRole("button", { name: "Scale duration", exact: true })
    .press("Enter");
  const wav = await download(page, "Download synthetic WAV");
  expect(wav.bytes.readUInt32LE(24)).toBe(48000);
  const project = await download(page, "Download project JSON");
  expect(parseProject(project.bytes.toString()).draft!.revision).toBe(1);
});
test("editing stops scheduled synthetic audio and field playback coordinates in both directions", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await page
    .getByRole("button", { name: "▶ Play my synthetic phrase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Scale duration", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  await page
    .getByRole("button", { name: "▶ Play my synthetic phrase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .click();
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Play synthetic seed timing", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stop synthetic", exact: true })
      .click();
  }
  await expect(page.getByLabel("Synthetic playback status")).toContainText(
    "stopped",
  );
});
test("mobile, enlarged text and unequal-count seed keep accessible controls and explicit limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await seed(page);
  await page
    .getByLabel("Add seed block", { exact: true })
    .selectOption("dswp-7");
  await expect(
    page.getByRole("region", { name: "Compare my creation", exact: true }),
  ).toContainText("0 eligible / 4 catalog recordings");
  await page.addStyleTag({ content: "html {font-size:200%;}" });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    scrollX,
    overflow: [...document.querySelectorAll("*")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right + scrollX > 320 ||
          e.scrollWidth > e.clientWidth + 2,
      )
      .map((e) => ({
        tag: e.tagName,
        class: e.className,
        right: e.getBoundingClientRect().right + scrollX,
        scroll: e.scrollWidth,
        client: e.clientWidth,
      }))
      .slice(0, 30),
  }));
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "Move earlier", exact: true })
    .press("Enter");
  expect((await storedDraft(page)).blocks[0].seed.recordingId).toBe("dswp-7");
});
