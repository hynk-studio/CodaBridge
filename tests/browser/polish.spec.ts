import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { composerView, labView, workspaceView } from "./navigation.ts";
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
    if (name === "Listen" || name === "Composer" || name === "Context Lab" || name === "Exchange") {
      await workspaceView(page, name); await hold(ms); return;
    }
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
  await click("Play seed timing");
  await click("Duplicate block");
  await click("Lengthen ×1.25");
  await click("Play this block");
  await click("Open first gap +0.05 s");
  const edited = await stored();
  expect(edited.draft.blocks[0]).toEqual(seed.draft.blocks[0]);
  expect(edited.draft.blocks).toHaveLength(2);
  await workspaceView(page, "Composer");
  if (!desktop) await capture("composer");
  await click("Play whole phrase", 3200);
  await click("Stop", 1000);
  await click("Compare & ask");
  await page.locator(".alternative-list").scrollIntoViewIfNeeded();
  await hold();
  await capture("candidates");
  await click("Open recording 11");
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
  await expect(page.getByLabel("Duration assignment", { exact: true })).toHaveValue("1");
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
  await page.getByRole("button", { name: "Play whole phrase", exact: true }).click();
  await page.getByRole("button", { name: "Save & codebook", exact: true }).press("Enter");
  await expect(page.locator("#composer")).toBeFocused();
  // Status is intentionally hidden in Save; its retained state must be stopped.
  await expect(page.getByLabel("Synthetic playback status")).toContainText("Stopped");
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
    await expect(page.getByRole("combobox", { name: "Workspace", exact: true })).toBeVisible();
    const fits = async (label: string) => {
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })) }));
      expect(layout.width, `${label} at ${width}px and 200% text: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(width);
    };
    await workspaceView(page, "Listen");
    await fits("Listen");
    for (const view of ["edit", "compare", "save"] as const) { await composerView(page, view); await fits(`Composer ${view}`); }
    for (const view of ["explore", "compare", "save"] as const) { await labView(page, view); await fits(`Lab ${view}`); }
  }
  await labView(page, "compare");
  await page.getByRole("figure", { name: "Observed and all distinct reassignment scores" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/edge-320-enlarged-controls.png`, fullPage: false });
});

test("responsive navigation keeps complete labels, focus, creation and playback context at enlarged text", async ({ page }, info) => {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
  await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const creation = await stored();
  const switcher = page.getByRole("combobox", { name: "Workspace", exact: true });
  const nav = page.getByRole("navigation", { name: "CodaBridge workspace", exact: true });
  await nav.getByRole("button", { name: "Composer", exact: true }).focus();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await expect(switcher).toBeVisible();
  await expect(switcher).toBeFocused();
  await expect(switcher).toHaveValue("composer");
  expect(await switcher.locator("option").allTextContents()).toEqual(["Listen", "Composer", "Context Lab", "Exchange"]);
  // The native control is keyboard operable; changing layout alone did not navigate.
  expect((await stored()).draft).toEqual(creation.draft);
  // macOS headless Chromium does not expose its native arrow-key popup to
  // browser automation. Native typeahead exercises all four destinations.
  for (const [key, value] of [["l", "listen"], ["c", "composer"], ["c", "lab"], ["e", "exchange"]]) {
    await switcher.press(key);
    await expect(switcher).toHaveValue(value);
    await expect(page.locator("#workspace")).toBeFocused();
  }
  await expect(page.locator("#workspace")).toBeFocused();
  await workspaceView(page, "Context Lab");
  await expect(page.locator(".context-lab")).toBeVisible();
  await switcher.selectOption("composer");
  await switcher.focus();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(nav.getByRole("button", { name: "Composer", exact: true })).toBeFocused();
  expect((await stored()).draft).toEqual(creation.draft);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const observations = [];
  for (const [width, height, scale] of [[1440, 1000, 1], [390, 844, 1], [320, 844, 1], [320, 844, 2], [1440, 1000, 2], [900, 1000, 2]]) {
    await page.setViewportSize({ width, height });
    await page.addStyleTag({ content: `html { font-size: ${scale * 100}%; }` });
    await expect(page.locator("html")).toHaveCSS("font-size", `${16 * scale}px`);
    // Wait for the content-based switcher to settle, then inspect full rendered
    // labels rather than accepting absence of document overflow as readability.
    await expect.poll(() => page.evaluate(() => {
      const tabs = document.querySelector(".workspace-tabs")!, space = document.querySelector(".product-navigation")!;
      return (tabs.getBoundingClientRect().width > space.clientWidth) === (document.querySelector(".site-header")!.getAttribute("data-compact") === "true");
    })).toBe(true);
    const layout = await nav.evaluate(element => {
      const select = element.querySelector("select")!;
      const compact = !select.closest("[hidden]");
      const css = getComputedStyle(select), canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!; context.font = css.font;
      const fitsSelect = [...select.options].every(option => context.measureText(option.text).width + parseFloat(css.paddingLeft) + parseFloat(css.paddingRight) + 24 <= select.clientWidth);
      const completeWords = [...element.querySelectorAll("button")].every(button => {
        const text = button.firstChild!, range = document.createRange();
        return button.textContent!.split(" ").every(word => {
          const start = button.textContent!.indexOf(word);
          range.setStart(text, start); range.setEnd(text, start + word.length);
          return range.getClientRects().length === 1;
        });
      });
      return { compact, readable: compact ? fitsSelect : completeWords, overflow: document.documentElement.scrollWidth > innerWidth, headerHeight: document.querySelector(".site-header")!.getBoundingClientRect().height, sticky: getComputedStyle(document.querySelector(".site-header")!).position === "sticky" };
    });
    expect(layout.readable, `${width}px / ${scale * 100}% text: complete destination labels`).toBe(true);
    expect(layout.overflow).toBe(false);
    if (layout.compact || width <= 650) expect(layout.sticky).toBe(false);
    expect((await stored()).draft).toEqual(creation.draft);
    await expect(page.getByLabel("Synthetic playback status")).toHaveText("Stopped");
    await page.getByRole("button", { name: "Edit phrase", exact: true }).click();
    await page.getByRole("button", { name: "Describe an edit with Astra →", exact: true }).press("Enter");
    const form = page.getByRole("form", { name: "Ask Astra about this creation" });
    await expect(form).toBeFocused();
    const top = await form.evaluate(element => element.getBoundingClientRect().top);
    const bottom = await page.locator(".site-header").evaluate(element => getComputedStyle(element).position === "sticky" ? element.getBoundingClientRect().bottom : 0);
    expect(top).toBeGreaterThanOrEqual(bottom + 4);
    await expect(form.getByRole("textbox", { name: "Your request", exact: true })).toHaveCSS("font-size", `${16 * scale}px`);
    observations.push({ width, height, scale, ...layout, focusedFormTop: top, stickyHeaderBottom: bottom });
  }
  await page.getByRole("button", { name: "Edit phrase", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored()).draft.blocks).not.toEqual(creation.draft.blocks);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await stored()).draft.blocks).toEqual(creation.draft.blocks);
  expect(posts).toEqual([]);
  await writeFile(info.outputPath("responsive-navigation.json"), JSON.stringify(observations, null, 2));
});
