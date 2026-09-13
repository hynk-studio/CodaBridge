import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { composerView, labView } from "./navigation.ts";
import { contextSegment } from "../../src/lab/catalog.ts";
import { comparePairing } from "../../src/lab/model.ts";
import { STORAGE_KEY } from "../../src/composer/project.ts";

const directory = "test-results/polish-review";
test.use({ video: { mode: "on", size: { width: 1440, height: 1000 } } });

test("visible local journey: separate workspaces, all scores, saved evidence and continuous editing", async ({ page }, info) => {
  test.setTimeout(180_000);
  const desktop = info.project.name === "desktop-chromium";
  const size = desktop ? "desktop" : "mobile";
  const posts: string[] = [], errors: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST") posts.push(request.url());
  });
  page.on("pageerror", error => errors.push(error.message));
  await mkdir(directory, { recursive: true });
  // Deliberate capture pacing only. This is an automated local walkthrough,
  // with no fixture, provider requests, or claim of human listening.
  const hold = async (ms = 1800) => { if (desktop) await page.waitForTimeout(ms); };
  const click = async (name: string, ms = 1800) => {
    const target = page.getByRole("button", { name, exact: true });
    await target.scrollIntoViewIfNeeded();
    await hold(400);
    await target.click();
    await hold(ms);
  };
  const capture = async (name: string) => page.screenshot({ path: `${directory}/after-${size}-${name}.png`, fullPage: false });
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const download = async (name: string, filename: string) => {
    const pending = page.waitForEvent("download");
    await click(name, 900);
    const file = await pending;
    const path = `${directory}/${size}-${filename}`;
    await file.saveAs(path);
    return readFile(path);
  };

  await page.goto("/");
  await expect(page.getByLabel("Playback status A")).toHaveText("Ready · source bytes checked");
  await hold(3000);
  await capture("listen");
  await click("Play recording A");
  await click("Make my version · 1.wav");
  const seed = await stored();
  if (desktop) await capture("composer");
  await click("Play synthetic seed timing");
  await click("Duplicate block");
  await click("Lengthen ×1.25");
  await click("Play selected synthetic block");
  await click("Open first gap +0.05 s");
  const edited = await stored();
  expect(edited.draft.blocks[0]).toEqual(seed.draft.blocks[0]);
  expect(edited.draft.blocks).toHaveLength(2);
  await page.getByRole("button", { name: "Composer", exact: true }).click();
  if (!desktop) await capture("composer");
  await click("▶ Play my synthetic phrase", 3200);
  await click("Stop synthetic", 1000);
  await click("Compare & ask");
  await page.locator(".alternative-list").scrollIntoViewIfNeeded();
  await hold();
  await capture("candidates");
  await click("Listen / compare dswp-11");
  await expect(page.getByLabel("Select recording B", { exact: true })).toHaveValue("dswp-11");
  await click("Play recording B");
  await click("Context Lab");
  await capture("lab");
  const originalTimeline = await page.locator(".exchange-timeline").innerHTML();
  await click("Play annotated timing window", 3500);
  await click("Stop reconstruction", 1000);
  await click("Compare pairings");
  const chart = page.getByRole("figure", { name: "Observed and all distinct reassignment scores" });
  await expect(chart.getByRole("button")).toHaveCount(9);
  const comparison = comparePairing(contextSegment, 1);
  await chart.getByRole("button", { name: `Control 1: ${comparison.selected.valueSeconds!.toFixed(3)} seconds. Inspect pairing`, exact: true }).click();
  await expect(page.getByLabel("Control offset", { exact: true })).toHaveValue("1");
  // Selecting a control changes analytical duration assignments only.
  expect(await page.locator(".exchange-timeline").innerHTML()).toBe(originalTimeline);
  await chart.scrollIntoViewIfNeeded();
  await hold(4000);
  await capture("controls");
  await click("Save investigation");
  const json = await download("Download investigation JSON", "investigation.json");
  const card = await download("Download investigation card", "investigation-card.png");
  const packet = JSON.parse(json.toString());
  expect(packet.comparison).toEqual(comparison);
  expect(packet.segment).toEqual(contextSegment);
  expect(packet.generated).toBeNull();
  expect(card.subarray(1, 4).toString()).toBe("PNG");

  await click("Composer");
  expect((await stored()).draft).toEqual(edited.draft);
  await click("Edit phrase");
  await click("Undo", 1200);
  expect((await stored()).draft.blocks[1].times).not.toEqual(edited.draft.blocks[1].times);
  await click("Redo", 1200);
  expect((await stored()).draft.blocks).toEqual(edited.draft.blocks);
  await click("Save & codebook");
  await click("Save active block to codebook", 1200);
  await capture("save");
  const wav = await download("Download synthetic WAV", "creation.wav");
  const image = await download("Download card image", "creation-card.png");
  const project = await download("Download project JSON", "project.json");
  expect(wav.subarray(0, 4).toString()).toBe("RIFF");
  expect(image.subarray(1, 4).toString()).toBe("PNG");
  expect(JSON.parse(project.toString()).draft).toEqual((await stored()).draft);
  const saved = await stored();
  await page.reload();
  await expect(page.locator(".composer-notice")).toContainText("Restored saved work from this browser");
  expect((await stored()).draft).toEqual(saved.draft);
  expect((await stored()).codebook).toEqual(saved.codebook);
  expect(posts).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(`${directory}/${size}-journey.json`, JSON.stringify({
    kind: "Actual local browser controls and downloads; no model fixture or model request",
    viewport: page.viewportSize(), modelRequests: posts, pageErrors: errors,
    distinctControlCount: 8, comparison, restoredDraft: true, restoredCodebook: true,
  }, null, 2));
  if (desktop) {
    const video = page.video();
    await page.close();
    await video?.saveAs(`${directory}/local-walkthrough.webm`);
  }
});

test("progression stops hidden playback, retains keyboard focus, and fits narrow enlarged layouts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
  const disclosureHeights = await page.locator("#composer summary:visible").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(disclosureHeights.every(height => height >= 44)).toBe(true);
  await page.getByRole("button", { name: "▶ Play my synthetic phrase", exact: true }).click();
  await page.getByRole("button", { name: "Save & codebook", exact: true }).press("Enter");
  await expect(page.locator("#composer")).toBeFocused();
  // Status is intentionally hidden in Save; its retained state must be stopped.
  await expect(page.getByLabel("Synthetic playback status")).toContainText("stopped");
  await page.keyboard.press("Tab");
  await expect(page.locator(".composer-heading input[type=file]")).toBeFocused();
  await labView(page, "explore");
  await page.getByRole("button", { name: "Play annotated timing window", exact: true }).click();
  await page.getByRole("button", { name: "Compare pairings", exact: true }).press("Enter");
  await expect(page.locator(".context-lab")).toBeFocused();
  await expect(page.locator(".context-lab [role=status]").filter({ hasText: "conservative combined gain" })).toContainText("stopped");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const fits = async (label: string) => {
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })) }));
      expect(layout.width, `${label} at ${width}px and 200% text: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(width);
    };
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await fits("Listen");
    for (const view of ["edit", "compare", "save"] as const) { await composerView(page, view); await fits(`Composer ${view}`); }
    for (const view of ["explore", "compare", "save"] as const) { await labView(page, view); await fits(`Lab ${view}`); }
  }
  await labView(page, "compare");
  await page.getByRole("figure", { name: "Observed and all distinct reassignment scores" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/edge-320-enlarged-controls.png`, fullPage: false });
});
