import { test, expect, type Page } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createWorker } from "../../server/worker.ts";
import { composerTransport } from "../fixtures/composer-provider.ts";
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
} from "../../src/composer/project.ts";
import { createDraft, type Draft } from "../../src/composer/model.ts";
import { eventSchedule, RENDERER } from "../../src/composer/sound.ts";

const outputDirectory = "docs/mvp03/evidence";
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
async function routeFixture(page: Page, transport: ProviderTransport) {
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
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
}
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
  await page.goto("/");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
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
  await page.getByLabel("Include analysis evidence", { exact: false }).check();
  const current = await storedDraft(page);
  await page.locator(".composer-workbench").screenshot({
    path: `${outputDirectory}/${info.project.name}-workbench.png`,
  });
  const wav = await download(page, "Download synthetic WAV"),
    card = await download(page, "Download card image"),
    project = await download(page, "Download project JSON");
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
  const mock = composerTransport();
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
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
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
    before.blocks[1].times.at(-1)! * 1.25,
    12,
  );
  await holdForCapture();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await storedDraft(page)).blocks).toEqual(before.blocks);
  await holdForCapture();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
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
