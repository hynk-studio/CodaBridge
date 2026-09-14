import { test, expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createDraft, seedBlock } from "../../src/composer/model.ts";
import { projectJson, STORAGE_KEY } from "../../src/composer/project.ts";
import { appendTurn, changeArrangement } from "../../src/exchange/format.ts";
import { seedPhrase, type Envelope } from "../../src/exchange/model.ts";
import { composerView, workspaceView } from "./navigation.ts";

const fixture = await readFile("tests/fixtures/exchange-canonical.json");
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
const privateMarker = "TEST_ONLY_PRIVATE_";
const region = (page: Page) => page.getByTestId("exchange");
const stored = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
const confirmReplace = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Discard current work and continue", exact: true }).click();
async function packet(page: Page, path: string, button = "Download coda JSON") {
  const promise = page.waitForEvent("download");
  await region(page).getByRole("button", { name: button, exact: true }).click();
  const download = await promise; await download.saveAs(path);
  const bytes = await readFile(path);
  return { bytes, path, name: download.suggestedFilename(), sha256: hash(bytes) };
}
async function open(page: Page, path: string | { name: string; mimeType: string; buffer: Buffer }) {
  await region(page).getByLabel("Open a coda file", { exact: true }).setInputFiles(path);
}
async function observe(context: BrowserContext) {
  await context.addInitScript(() => {
    const starts: number[] = []; Object.assign(window, { __exchangeStarts: starts });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) { starts.push(this.buffer?.length ?? 0); return start.apply(this, args); };
  });
}
async function profile(browser: Browser, info: TestInfo) {
  const context = await browser.newContext({ viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  await observe(context);
  const page = await context.newPage();
  const requests: { method: string; url: string }[] = [], errors: string[] = [], logs: string[] = [];
  let leaked = false;
  page.on("request", request => { if ((request.url() + (request.postData() ?? "")).includes(privateMarker)) leaked = true; requests.push({ method: request.method(), url: request.url() }); });
  page.on("pageerror", error => errors.push(error.name));
  page.on("console", message => { if (message.text().includes(privateMarker)) leaked = true; logs.push(message.type()); });
  return { context, page, audit: () => ({ requests, errors, logs, privateTextInNetworkOrLogs: leaked }) };
}
async function privateProject(page: Page, who: "A" | "B", history = true) {
  const draft = createDraft(who === "A" ? "dswp-1" : "dswp-2");
  draft.id = `private-project-${who}`; draft.title = `${privateMarker}${who}_TITLE`;
  draft.intention = `${privateMarker}${who}_INTENTION`;
  draft.blocks[0].meaning = `${privateMarker}${who}_MEANING`;
  const unselected = seedBlock("dswp-7", `private-unused-${who}`); unselected.meaning = `${privateMarker}${who}_UNSELECTED`;
  draft.blocks.push(unselected); draft.ancestry.push(unselected.seed);
  const book = seedBlock("dswp-11", `private-codebook-${who}`); book.meaning = `${privateMarker}${who}_CODEBOOK`;
  const json = projectJson(draft, [book], { identity: "TEST ONLY saved analysis", text: `${privateMarker}${who}_ANALYSIS` }, draft.blocks[0].id);
  await page.addInitScript(({ key, json }) => { if (!sessionStorage.getItem("test-only-initialized")) { localStorage.setItem(key, json); sessionStorage.setItem("test-only-initialized", "yes"); } }, { key: STORAGE_KEY, json });
  await page.goto("/#composer");
  if (history) {
    await composerView(page, "edit");
    await page.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
    await page.getByRole("button", { name: "Open first gap +0.05 s", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  }
  return (await stored(page))!;
}
async function unchanged(page: Page, before: string) {
  // Boolean comparison keeps private fixture text out of failure logs.
  await expect.poll(async () => (await stored(page)) === before).toBe(true);
}
async function finalHistoryCheck(page: Page, before: string) {
  await unchanged(page, before); await composerView(page, "edit");
  const initial = JSON.parse(before);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = JSON.parse((await stored(page))!);
  expect(JSON.stringify(undone.draft.blocks) === JSON.stringify(initial.draft.blocks)).toBe(false);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const after = JSON.parse((await stored(page))!);
  expect(JSON.stringify(after.draft.blocks) === JSON.stringify(initial.draft.blocks)).toBe(true);
  expect(JSON.stringify(after.codebook) === JSON.stringify(initial.codebook)).toBe(true);
  expect(after.activeId === initial.activeId).toBe(true);
  await workspaceView(page, "Exchange");
}
async function fillTurn(page: Page, message: string, alias: string) {
  await region(page).getByLabel("Message to include", { exact: true }).fill(message);
  await region(page).getByLabel("Display alias (optional)", { exact: true }).fill(alias);
  await region(page).getByLabel("Style label (optional)", { exact: true }).fill("TEST ONLY hand-edited timing");
}

test("actual isolated A1/B1/A2 file round trip preserves both private Composer histories; cold reopen and seed reply", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const dir = `test-results/coda-exchange/${info.project.name}`; await mkdir(dir, { recursive: true });
  const A = await profile(browser, info), B = await profile(browser, info), C = await profile(browser, info);
  try {
    const originalA = await privateProject(A.page, "A"), originalB = await privateProject(B.page, "B");
    expect(originalA === originalB).toBe(false);
    await composerView(A.page, "save");
    await expect(A.page.getByLabel("Include the whole phrase", { exact: true })).not.toBeChecked();
    await A.page.getByRole("button", { name: "Make a transmission", exact: true }).click();
    await expect(region(A.page).getByLabel("Message to include")).toHaveValue("");
    expect(await region(A.page).getByLabel("Outgoing block", { exact: true }).locator("option").count()).toBe(1);
    await fillTurn(A.page, "TEST ONLY A1: A small signal across the water. 🌊", "TEST ONLY A");
    await region(A.page).getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
    await region(A.page).getByRole("button", { name: "Undo timing", exact: true }).click();
    await region(A.page).getByRole("button", { name: "Redo timing", exact: true }).click();
    await region(A.page).getByText("Adjust individual gaps", { exact: true }).click();
    const gap = region(A.page).getByLabel("Outgoing gap 1 (seconds)", { exact: true });
    await gap.fill("0.2"); await gap.locator("xpath=ancestor::form").getByRole("button", { name: "Set", exact: true }).click();
    await unchanged(A.page, originalA);
    await A.page.evaluate(() => window.scrollTo(0, 0)); await A.page.screenshot({ path: `${dir}/A1-preview.png` });
    await region(A.page).getByRole("button", { name: "Finalize A1", exact: true }).click();
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(1);
    const a1 = await packet(A.page, `${dir}/A1.coda.json`), repeated = await packet(A.page, `${dir}/A1-repeat.coda.json`);
    expect(repeated.bytes.equals(a1.bytes)).toBe(true);
    const first: Envelope = JSON.parse(a1.bytes.toString());
    expect(first.turns[0].phrase.blocks).toHaveLength(1); expect(first.turns[0].phrase.blocks[0].source.recordingId).toBe("dswp-1");
    await unchanged(A.page, originalA);

    await workspaceView(B.page, "Exchange"); await open(B.page, a1.path);
    await expect(region(B.page).getByTestId("exchange-turn")).toHaveCount(1);
    expect(await B.page.evaluate(() => (window as any).__exchangeStarts.length)).toBe(0);
    await region(B.page).getByRole("button", { name: "Play A1 only", exact: true }).click();
    await expect(region(B.page).getByTestId("exchange-turn")).toHaveClass(/is-playing/);
    await region(B.page).getByRole("button", { name: "Stop Exchange audio", exact: true }).click();
    await unchanged(B.page, originalB);
    await region(B.page).getByRole("button", { name: "Reply with my style", exact: true }).click();
    await expect(region(B.page).getByLabel("Message to include")).toHaveValue("");
    await fillTurn(B.page, "TEST ONLY B1: Received as a local file. Here is a different rhythm. 안녕", "TEST ONLY B");
    await region(B.page).getByRole("button", { name: "Shorten ×0.8", exact: true }).click();
    await region(B.page).getByRole("button", { name: "Finalize B1", exact: true }).click();
    await expect(region(B.page).getByTestId("exchange-turn")).toHaveCount(2);
    const b1 = await packet(B.page, `${dir}/A1-B1.coda.json`), second: Envelope = JSON.parse(b1.bytes.toString());
    expect(second.turns[0]).toEqual(first.turns[0]); expect(second.turns[1].phrase.blocks[0].source.recordingId).toBe("dswp-2");
    await unchanged(B.page, originalB);

    await open(A.page, b1.path); await expect(A.page.getByRole("dialog")).toBeVisible();
    await A.page.getByRole("button", { name: "Keep current work", exact: true }).click();
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(1);
    await open(A.page, b1.path); await confirmReplace(A.page);
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(2);
    await unchanged(A.page, originalA);
    await region(A.page).getByLabel("Pattern for this turn", { exact: true }).selectOption(`turn:${first.turns[0].id}`);
    await region(A.page).getByRole("button", { name: "Reply with my style", exact: true }).click();
    await fillTurn(A.page, "TEST ONLY A2: Keeping your reply with mine. This is a human exchange, not whale translation.", "TEST ONLY A");
    await region(A.page).getByRole("button", { name: "Shorten ×0.8", exact: true }).click();
    await region(A.page).getByRole("button", { name: "Finalize A2", exact: true }).click();
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(3);
    await expect(region(A.page).getByLabel("Pattern for this turn", { exact: true })).toHaveValue("composer-selected");
    const gapBetween = region(A.page).getByLabel("Gap after A1 (seconds)", { exact: true });
    await gapBetween.fill("0.75"); await gapBetween.locator("xpath=ancestor::form").getByRole("button", { name: "Set", exact: true }).click();
    await expect(region(A.page).getByRole("status").first()).toContainText("Playback gap updated");
    await region(A.page).getByRole("button", { name: "Play complete exchange", exact: true }).click();
    await expect(region(A.page).locator(".exchange-sound")).toContainText("Playing synthetic clicks");
    await expect(region(A.page).getByTestId("exchange-turn").first()).toHaveClass(/is-playing/);
    await expect(region(A.page).getByTestId("exchange-turn").nth(1)).toHaveClass(/is-playing/);
    await expect(region(A.page).getByTestId("exchange-turn").nth(2)).toHaveClass(/is-playing/);
    await expect(region(A.page).locator(".exchange-sound")).toContainText("stopped");
    await region(A.page).getByRole("button", { name: "Play complete exchange", exact: true }).click();
    await region(A.page).getByRole("button", { name: "Stop Exchange audio", exact: true }).click();
    await expect(region(A.page).locator(".exchange-sound")).toContainText("stopped");
    await A.page.evaluate(() => window.scrollTo(0, 0)); await A.page.screenshot({ path: `${dir}/final-exchange.png` });
    await region(A.page).getByTestId("exchange-turn").first().scrollIntoViewIfNeeded(); await A.page.screenshot({ path: `${dir}/final-turns.png` });
    const final = await packet(A.page, `${dir}/A1-B1-A2.coda.json`), wav = await packet(A.page, `${dir}/A1-B1-A2.wav`, "Download Exchange WAV");
    const third: Envelope = JSON.parse(final.bytes.toString());
    expect(third.turns.slice(0, 2)).toEqual(second.turns); expect(third.arrangement.gaps).toEqual([.75, .5]);
    expect(third.turns.map(t => t.role)).toEqual(["A", "B", "A"]);
    expect(third.turns[2].parent).toEqual({ turnId: second.turns[1].id, digest: second.turns[1].digest });
    for (const file of [a1, repeated, b1, final, wav]) { expect(file.bytes.includes(privateMarker)).toBe(false); expect(file.bytes.includes("dswp-7")).toBe(false); expect(file.bytes.includes("dswp-11")).toBe(false); }
    await unchanged(A.page, originalA);

    await C.page.goto("/#exchange"); expect(await stored(C.page)).toBeNull();
    await open(C.page, final.path); await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(3);
    for (const [i, turn] of third.turns.entries()) {
      const card = region(C.page).getByTestId("exchange-turn").nth(i);
      await expect(card).toContainText(turn.message); await expect(card).toHaveAttribute("data-digest", turn.digest);
    }
    const reopened = await packet(C.page, `${dir}/fresh-reopened.coda.json`);
    expect(reopened.bytes.equals(final.bytes)).toBe(true); expect(await stored(C.page)).toBeNull();
    C.page.on("dialog", dialog => dialog.accept()); await C.page.reload();
    await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(0);
    await open(C.page, final.path); await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(3);
    await region(C.page).getByLabel("Pattern for this turn", { exact: true }).selectOption("seed:dswp-11");
    await region(C.page).getByRole("button", { name: "Reply with my style", exact: true }).click();
    await fillTurn(C.page, "TEST ONLY cold-profile reply from a supported catalog seed.", "TEST ONLY cold visitor");
    await region(C.page).getByRole("button", { name: "Finalize B2", exact: true }).click();
    await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(4);
    const cold = await packet(C.page, `${dir}/cold-reply.coda.json`);
    expect(JSON.parse(cold.bytes.toString()).turns[3].phrase.blocks[0].source.recordingId).toBe("dswp-11");
    expect(await stored(C.page)).toBeNull();
    await finalHistoryCheck(A.page, originalA); await finalHistoryCheck(B.page, originalB);
    const afterComposer = await packet(A.page, `${dir}/after-composer-edits.coda.json`);
    expect(afterComposer.bytes.equals(final.bytes)).toBe(true);
    const audits = [A.audit(), B.audit(), C.audit()];
    for (const audit of audits) {
      expect(audit.privateTextInNetworkOrLogs).toBe(false); expect(audit.errors).toEqual([]);
      expect(audit.requests.filter(r => r.method !== "GET")).toEqual([]);
      // Browser downloads also emit request events for same-origin blob URLs;
      // those read in-memory files, not an external network destination.
      expect(audit.requests.filter(r => !r.url.startsWith("http://127.0.0.1:4173/") && !r.url.startsWith("blob:http://127.0.0.1:4173/"))).toEqual([]);
    }
    await writeFile(`${dir}/round-trip.json`, JSON.stringify({ identity: "TEST ONLY automated isolated-browser acceptance; no human listening or real delivery", browser: info.project.name,
      isolatedContexts: 3, originalPrivateStateSha256: [hash(originalA), hash(originalB)], privateStatePreserved: true, undoRedoExercised: true,
      completePriorTurnsPreserved: true, fullReplayObservedAllThreeTurns: true, freshReopenByteIdentical: true, refreshClearedExchangeMemory: true, coldReplyWithoutComposer: true,
      originalComposerEditsCannotMutateTurns: true,
      artifacts: [a1, b1, final, wav, reopened, cold, afterComposer].map(f => ({ path: f.path, filename: f.name, bytes: f.bytes.length, sha256: f.sha256 })), audits }, null, 2));
  } finally { await A.context.close(); await B.context.close(); await C.context.close(); }
});

test("full phrase copying, saved analysis, outgoing cancel and navigation preserve personal work", async ({ page }) => {
  const before = await privateProject(page, "A", false);
  expect(JSON.parse(before).savedAnalysis !== null).toBe(true);
  await composerView(page, "save"); await page.getByLabel("Include the whole phrase", { exact: true }).check();
  await page.getByRole("button", { name: "Make a transmission", exact: true }).click();
  expect(await region(page).getByLabel("Outgoing block", { exact: true }).locator("option").count()).toBe(2);
  await fillTurn(page, "TEST ONLY pending note survives workspace navigation.", "TEST ONLY author");
  for (const workspace of ["Listen", "Composer", "Context Lab", "Exchange"] as const) await workspaceView(page, workspace);
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY pending note survives workspace navigation.");
  await unchanged(page, before);
  await region(page).getByRole("button", { name: "Cancel outgoing draft", exact: true }).click();
  await page.getByRole("button", { name: "Keep current work", exact: true }).click();
  await expect(region(page).getByTestId("outgoing-draft")).toBeVisible();
  await region(page).getByRole("button", { name: "Cancel outgoing draft", exact: true }).click(); await confirmReplace(page);
  await expect(region(page).getByTestId("outgoing-draft")).toHaveCount(0); await unchanged(page, before);
  await open(page, { name: "actual-test-fixture.coda.json", mimeType: "application/json", buffer: fixture });
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1); await unchanged(page, before);
  await region(page).getByRole("button", { name: "Reset Exchange", exact: true }).click(); await confirmReplace(page);
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(0); await unchanged(page, before);
});

test("imports are atomic, duplicate snapshots preserve unfinished text, alternatives require explicit replacement", async ({ page }) => {
  await page.goto("/#exchange");
  await open(page, { name: "safe.coda.json", mimeType: "application/json", buffer: fixture });
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
  await region(page).getByRole("button", { name: "Reply with my style", exact: true }).click();
  await fillTurn(page, "TEST ONLY do not discard this unfinished reply.", "TEST ONLY B");
  await region(page).getByLabel("Message to include").fill("x".repeat(2001));
  await expect(region(page).getByRole("alert")).toContainText("allowed size");
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY do not discard this unfinished reply.");
  await region(page).getByLabel("Display alias (optional)").fill("x".repeat(49));
  await expect(region(page).getByLabel("Display alias (optional)")).toHaveValue("TEST ONLY B");
  await open(page, { name: "same.coda.json", mimeType: "application/json", buffer: fixture });
  await expect(region(page).getByRole("status").first()).toContainText("already open");
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY do not discard this unfinished reply.");
  const bad = JSON.parse(fixture.toString()); bad.turns[0].phrase.blocks[0].source.sourceRevision = "wrong";
  for (const bytes of [Buffer.from("{"), Buffer.from(JSON.stringify(bad)), Buffer.from("[".repeat(200) + "0" + "]".repeat(200)), Buffer.alloc(512 * 1024 + 1)]) {
    await open(page, { name: "broken.coda.json", mimeType: "application/json", buffer: bytes });
    await expect(region(page).getByRole("alert")).toBeVisible();
    await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
    await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY do not discard this unfinished reply.");
  }
  const variant = JSON.parse(fixture.toString()).turns[0]; delete variant.digest;
  variant.id = "outgoing"; // A valid imported ID must not collide with a UI-only draft cue.
  variant.message = 'TEST ONLY <img src="https://invalid.example/probe" onerror="alert(1)"> https://invalid.example/ is inert text.';
  const alternate = await appendTurn(null, variant);
  const outgoing: string[] = []; page.on("request", r => outgoing.push(r.url()));
  await open(page, { name: "alternative.coda.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(alternate)) });
  await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Keep current work", exact: true }).click();
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY do not discard this unfinished reply.");
  await open(page, { name: "alternative.coda.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(alternate)) }); await confirmReplace(page);
  await expect(region(page).getByTestId("outgoing-draft")).toHaveCount(0);
  await expect(region(page).getByTestId("exchange-turn")).toContainText(variant.message);
  expect(await region(page).getByTestId("exchange-turn").locator("a, img").count()).toBe(0);
  expect(outgoing.some(u => u.includes("invalid.example"))).toBe(false);
  await region(page).getByRole("button", { name: "Play A1 only", exact: true }).click();
  await expect(region(page).locator(".exchange-sound")).toContainText(" · A1");
  await region(page).getByRole("button", { name: "Stop Exchange audio", exact: true }).click();
});

test("late file reads, hashes and resumed audio cannot resurrect obsolete work after replacement/navigation", async ({ page }) => {
  await observe(page.context());
  await page.addInitScript(() => {
    const read = File.prototype.arrayBuffer, digest = crypto.subtle.digest.bind(crypto.subtle), resume = AudioContext.prototype.resume;
    Object.assign(window, { __delayHash: false, __delayResume: false, __digestsCompleted: 0 });
    File.prototype.arrayBuffer = async function() { if (this.name === "slow.coda.json") await new Promise<void>(r => Object.assign(window, { __releaseRead: r })); return read.call(this); };
    crypto.subtle.digest = async function(...args) {
      if ((window as any).__delayHash) { (window as any).__delayHash = false; await new Promise<void>(r => Object.assign(window, { __releaseHash: r })); }
      const result = await digest(...args); (window as any).__digestsCompleted++; return result;
    };
    AudioContext.prototype.resume = async function() { if ((window as any).__delayResume) await new Promise<void>(r => Object.assign(window, { __releaseResume: r })); return resume.call(this); };
  });
  await page.goto("/#exchange");
  const a: Envelope = JSON.parse(fixture.toString());
  const b = await appendTurn(a, { id: "turn-second", exchangeId: a.exchangeId, role: "B", alias: "TEST ONLY B", label: "", createdAt: null, message: "TEST ONLY newer snapshot", phrase: seedPhrase("dswp-2"), parent: { turnId: a.turns[0].id, digest: a.turns[0].digest } });
  await open(page, { name: "slow.coda.json", mimeType: "application/json", buffer: fixture });
  await expect.poll(() => page.evaluate(() => typeof (window as any).__releaseRead)).toBe("function");
  await open(page, { name: "fast.coda.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(b)) });
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(2);
  await region(page).getByLabel("Pattern for this turn", { exact: true }).selectOption(`turn:${a.turns[0].id}`);
  const readHashes = await page.evaluate(() => (window as any).__digestsCompleted);
  await page.evaluate(() => (window as any).__releaseRead());
  await expect.poll(() => page.evaluate(() => (window as any).__digestsCompleted)).toBe(readHashes + 2);
  await expect(region(page).getByTestId("exchange-turn").nth(1)).toContainText("TEST ONLY newer snapshot");
  await expect(region(page).getByLabel("Pattern for this turn", { exact: true })).toHaveValue(`turn:${a.turns[0].id}`);
  const different = await changeArrangement(b, 0, .75);
  await open(page, { name: "explicit-alternative.coda.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(different)) });
  await confirmReplace(page);
  await expect(region(page).getByLabel("Pattern for this turn", { exact: true })).toHaveValue("seed:dswp-1");
  await region(page).getByRole("button", { name: "Reply with my style", exact: true }).click();
  await fillTurn(page, "TEST ONLY unfinished latest edit", "TEST ONLY A");
  const beforeFinalize = await page.evaluate(() => { (window as any).__delayHash = true; return (window as any).__digestsCompleted; });
  await region(page).getByRole("button", { name: "Finalize A2", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).__releaseHash)).toBe("function");
  await region(page).getByRole("button", { name: "Lengthen ×1.25", exact: true }).click();
  await page.evaluate(() => (window as any).__releaseHash());
  // Wait for prefix verification (3), new turn hash (1), envelope hash (1).
  await expect.poll(() => page.evaluate(() => (window as any).__digestsCompleted)).toBe(beforeFinalize + 5);
  await expect(region(page).getByTestId("outgoing-draft")).toBeVisible();
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(2);
  await page.evaluate(() => { (window as any).__delayResume = true; });
  await region(page).getByRole("button", { name: "Play complete exchange", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).__releaseResume)).toBe("function");
  await workspaceView(page, "Listen"); await page.evaluate(() => (window as any).__releaseResume());
  await workspaceView(page, "Exchange");
  expect(await page.evaluate(() => (window as any).__exchangeStarts)).toEqual([]);
  await expect(region(page).locator(".exchange-sound")).toContainText("stopped");
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY unfinished latest edit");
});

test("TEST ONLY native-share bridge checks the actual File; cancellation/rejection never download or duplicate turns", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __shareMode: "cancel", __shareCalls: 0, __fileChecked: false });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data: ShareData) => {
      const file = data.files?.[0]; (window as any).__fileChecked = file instanceof File && file.type === "application/json" && file.name.endsWith(".coda.json") && file.size > 0;
      return (window as any).__shareMode !== "unsupported" && (window as any).__fileChecked;
    } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      (window as any).__shareCalls++; (window as any).__sharedBytes = await data.files![0].text();
      if ((window as any).__shareMode === "cancel") throw new DOMException("TEST ONLY cancellation", "AbortError");
      if ((window as any).__shareMode === "reject") throw new Error("TEST ONLY unavailable target");
    } });
  });
  await page.goto("/#exchange"); await open(page, { name: "test.coda.json", mimeType: "application/json", buffer: fixture });
  const downloads: string[] = []; page.on("download", d => downloads.push(d.suggestedFilename()));
  const button = region(page).getByRole("button", { name: "Share file", exact: true });
  await expect(button).toBeEnabled(); await button.click();
  await expect(region(page).getByRole("status").first()).toContainText("Share cancelled");
  expect(downloads).toEqual([]); expect(await page.evaluate(() => (window as any).__sharedBytes)).toBe(fixture.toString());
  await page.evaluate(() => { (window as any).__shareMode = "reject"; }); await button.click();
  await expect(region(page).getByRole("alert")).toContainText("Sharing could not complete"); expect(downloads).toEqual([]);
  await page.evaluate(() => { (window as any).__shareMode = "success"; }); await button.click();
  await expect(region(page).getByRole("status").first()).toContainText("Recipient delivery and reading are unknown");
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1); expect(downloads).toEqual([]);
  await page.evaluate(() => { (window as any).__shareMode = "unsupported"; });
  await workspaceView(page, "Listen"); await workspaceView(page, "Exchange"); await expect(button).toBeDisabled();
  const pending = page.waitForEvent("download"); await region(page).getByRole("button", { name: "Download coda JSON", exact: true }).click(); await pending;
  expect(downloads).toHaveLength(1); expect(await page.evaluate(() => (window as any).__fileChecked)).toBe(true);
});

test("320px/enlarged-text/keyboard controls and audio failure keep messages, timing and downloads usable", async ({ page }, info) => {
  const dir = `test-results/coda-exchange/${info.project.name}`; await mkdir(dir, { recursive: true });
  await page.goto("/#exchange"); await open(page, { name: "test.coda.json", mimeType: "application/json", buffer: fixture });
  await region(page).getByRole("button", { name: "Reply with my style", exact: true }).click();
  await fillTurn(page, "TEST ONLY keyboard-accessible reply with numeric timing.", "TEST ONLY author");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${dir}/320px.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${dir}/320px-enlarged.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await region(page).getByLabel("Message to include").focus(); await page.keyboard.press("Tab");
  await expect(region(page).getByLabel("Display alias (optional)")).toBeFocused();
  await page.screenshot({ path: `${dir}/320px-enlarged-editor.png` });
  await region(page).getByText("Adjust individual gaps", { exact: true }).focus(); await page.keyboard.press("Enter");
  const input = region(page).getByLabel("Outgoing gap 1 (seconds)", { exact: true }); await expect(input).toBeVisible();
  await input.fill("0.2"); await input.press("Enter"); await expect(input).toHaveValue("0.2");
  await page.screenshot({ path: `${dir}/320px-enlarged-timing.png` });
  await page.evaluate(() => { Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined }); });
  await region(page).getByRole("button", { name: "Audition outgoing pattern", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("audio is unavailable");
  await region(page).getByRole("button", { name: "Finalize B1", exact: true }).click();
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(2);
  const download = page.waitForEvent("download"); await region(page).getByRole("button", { name: "Download coda JSON", exact: true }).click(); await download;
});

test("Exchange shares the exclusive sound owner and preserves Atlas comparison and both Prediction Reveal resets", async ({ page }) => {
  const before = await privateProject(page, "A", false);
  await workspaceView(page, "Exchange"); await open(page, { name: "test.coda.json", mimeType: "application/json", buffer: fixture });
  await region(page).getByRole("button", { name: "Reply with my style", exact: true }).click();
  await fillTurn(page, "TEST ONLY pending through sound and research navigation.", "TEST ONLY author");
  await region(page).getByRole("button", { name: "Audition outgoing pattern", exact: true }).click();
  await expect(region(page).locator(".exchange-sound")).toContainText("Playing");
  await composerView(page, "compare");
  await expect(region(page).locator(".exchange-sound")).toContainText("stopped");
  await expect(page.getByTestId("composer-atlas-comparison")).toBeVisible();
  const binding = await page.getByTestId("composer-atlas-comparison").getAttribute("data-binding");
  await page.getByRole("button", { name: "Play whole phrase", exact: true }).click();
  await workspaceView(page, "Exchange");
  await expect(page.locator('[aria-label="Synthetic playback status"]')).toHaveText("Stopped");
  await workspaceView(page, "Listen");
  await page.getByRole("button", { name: "Play recording A", exact: true }).click();
  await workspaceView(page, "Exchange");
  expect(await page.locator("audio").evaluateAll(elements => elements.every(e => (e as HTMLAudioElement).paused))).toBe(true);
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
  await page.getByRole("button", { name: "Play complete annotated row", exact: true }).click();
  await workspaceView(page, "Exchange");
  await expect(page.getByTestId("style-atlas").getByText("Synthetic playback stopped", { exact: true })).toHaveCount(1);
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await page.getByRole("button", { name: "Reveal actual next coda", exact: true }).click();
  await expect(page.getByTestId("prediction-target")).toBeVisible();
  await workspaceView(page, "Exchange"); await workspaceView(page, "Context Lab");
  await expect(page.getByTestId("prediction-target")).toHaveCount(0);
  await page.getByRole("button", { name: "Follow-up research · v0.2", exact: true }).click();
  await page.getByRole("button", { name: "Reveal v0.2 actual next coda", exact: true }).click();
  await expect(page.getByTestId("research-target")).toBeVisible();
  await workspaceView(page, "Exchange"); await workspaceView(page, "Context Lab");
  await expect(page.getByTestId("research-target")).toHaveCount(0);
  await composerView(page, "compare"); await expect(page.getByTestId("composer-atlas-comparison")).toHaveAttribute("data-binding", binding!);
  await workspaceView(page, "Exchange");
  await expect(region(page).getByLabel("Message to include")).toHaveValue("TEST ONLY pending through sound and research navigation.");
  await unchanged(page, before);
});

test("eight-turn files remain readable and downloadable at the reply limit", async ({ page }) => {
  let envelope: Envelope = JSON.parse(fixture.toString());
  for (let i = 1; i < 8; i++) {
    const last = envelope.turns.at(-1)!;
    envelope = await appendTurn(envelope, { id: `turn-bound-${i}`, exchangeId: envelope.exchangeId, role: i % 2 ? "B" : "A",
      alias: "TEST ONLY author", label: "", createdAt: null, message: `TEST ONLY bounded turn ${i + 1}`,
      phrase: seedPhrase(i % 2 ? "dswp-2" : "dswp-1"), parent: { turnId: last.id, digest: last.digest } });
  }
  await page.goto("/#exchange");
  await open(page, { name: "eight-turns.coda.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(8);
  await expect(region(page).getByRole("button", { name: "Reply with my style", exact: true })).toBeDisabled();
  await expect(region(page).getByRole("button", { name: "Download coda JSON", exact: true })).toBeEnabled();
  await region(page).getByRole("button", { name: "Reset Exchange", exact: true }).click();
  await page.getByRole("button", { name: "Keep current work", exact: true }).click();
  await expect(region(page).getByTestId("exchange-turn").last()).toContainText("TEST ONLY bounded turn 8");
});
