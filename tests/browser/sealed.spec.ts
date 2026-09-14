import { test, expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createDraft, seedBlock } from "../../src/composer/model.ts";
import { projectJson, STORAGE_KEY } from "../../src/composer/project.ts";
import { decryptArtifact, encryptPublicFixture } from "../../scripts/verify-sealed.mjs";
import { composerView, workspaceView } from "./navigation.ts";

// Opening codes may appear in DOM action arguments. Never retain traces or
// failure snapshots. Only explicit masked screenshots below become evidence.
test.use({ trace: "off", screenshot: "off" });
const fixture = await readFile("tests/fixtures/sealed/independent.coda.sealed.json");
const manifest = JSON.parse(await readFile("tests/fixtures/sealed/PUBLIC-TEST-ONLY-keys.json", "utf8"));
const code: string = manifest.entries[0].openingCode;
const originalPlain = await readFile("tests/fixtures/exchange-canonical.json");
const wrong = "cbsk1-" + Buffer.alloc(32).toString("base64url");
const region = (p: Page) => p.getByTestId("exchange");
const button = (p: Page, name: string) => region(p).getByRole("button", { name, exact: true });
const open = (p: Page, file: string | Buffer) => region(p).getByLabel("Open a coda file", { exact: true }).setInputFiles(typeof file === "string" ? file : { name: "public-test-only.coda.sealed.json", mimeType: "application/json", buffer: file });
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const storage = (p: Page) => p.evaluate(k => localStorage.getItem(k), STORAGE_KEY);
const keep = (p: Page) => p.getByRole("dialog").getByRole("button", { name: "Keep current work", exact: true }).click();
const accept = (p: Page, name = "Discard current work and continue") => p.getByRole("dialog").getByRole("button", { name, exact: true }).click();
async function unlock(p: Page, opening = code) { await region(p).getByLabel("Opening code", { exact: true }).fill(opening); await button(p, "Unlock file").click(); }
async function entry(p: Page) { await p.goto("/#exchange"); await expect(region(p)).toBeVisible(); }
async function receive(p: Page, file: string | Buffer, opening: string, count: number) {
  const prior = await region(p).getByTestId("exchange-turn").count();
  await open(p, file); await expect(region(p).getByTestId("sealed-locked")).toBeVisible();
  await unlock(p, opening);
  if (prior && prior !== count) { await expect(p.getByRole("dialog")).toBeVisible(); await accept(p); }
  await expect(region(p).getByTestId("exchange-turn")).toHaveCount(count);
  await expect(region(p)).toHaveAttribute("data-mode", "private");
}
async function installPrivate(p: Page, who: string) {
  const d = createDraft(who === "A" ? "dswp-1" : "dswp-2");
  d.title = `TEST_ONLY_PRIVATE_${who}_TITLE`; d.intention = `TEST_ONLY_PRIVATE_${who}_INTENTION`; d.blocks[0].meaning = `TEST_ONLY_PRIVATE_${who}_MEANING`;
  const other = seedBlock("dswp-7"); other.meaning = `TEST_ONLY_PRIVATE_${who}_UNSELECTED`; d.blocks.push(other); d.ancestry.push(other.seed);
  const saved = seedBlock("dswp-11"); saved.meaning = `TEST_ONLY_PRIVATE_${who}_CODEBOOK`;
  const json = projectJson(d, [saved], { identity: "TEST ONLY analysis", value: `TEST_ONLY_PRIVATE_${who}_ANALYSIS` }, d.blocks[0].id);
  await p.addInitScript(({ key, value }) => { if (!sessionStorage.getItem("test-only-initialized")) { localStorage.setItem(key, value); sessionStorage.setItem("test-only-initialized", "yes"); } }, { key: STORAGE_KEY, value: json });
  await p.goto("/#composer"); await composerView(p, "edit");
  await p.getByRole("button", { name: "Lengthen ×1.25", exact: true }).click(); await p.getByRole("button", { name: "Open first gap +0.05 s", exact: true }).click(); await p.getByRole("button", { name: "Undo", exact: true }).click();
  const before = (await storage(p))!; await workspaceView(p, "Exchange"); return before;
}
async function privateUnchanged(p: Page, before: string, history = false) {
  expect(await storage(p) === before).toBe(true);
  if (history) {
    await composerView(p, "edit"); await expect(p.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
    await p.getByRole("button", { name: "Undo", exact: true }).click(); expect(await storage(p) === before).toBe(false);
    await p.getByRole("button", { name: "Redo", exact: true }).click();
    const after = JSON.parse((await storage(p))!), original = JSON.parse(before);
    expect(JSON.stringify(after.draft.blocks) === JSON.stringify(original.draft.blocks)).toBe(true);
    expect(JSON.stringify(after.codebook) === JSON.stringify(original.codebook)).toBe(true);
    expect(after.activeId === original.activeId).toBe(true); await workspaceView(p, "Exchange");
  }
}
async function profile(browser: Browser, info: TestInfo) {
  const context = await browser.newContext({ viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  await context.addInitScript(() => {
    // TEST ONLY observation of real native crypto input, never replacement RNG
    // or cipher. Clear each captured plaintext immediately after recording it.
    const w = window as any; w.__sealedInputs = []; w.__sealedRngLengths = []; w.__sealedStorageLeak = false;
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle), rng = crypto.getRandomValues.bind(crypto);
    crypto.subtle.encrypt = async (...args) => { const data = args[2]; const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data); w.__sealedInputs.push(Array.from(bytes)); return encrypt(...args); };
    crypto.getRandomValues = ((value: Uint8Array<ArrayBuffer>) => { w.__sealedRngLengths.push(value.byteLength); return rng(value); }) as typeof crypto.getRandomValues;
    const store = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (/cbsk1-|PUBLIC_TEST_ONLY_SEALED_/.test(k + v)) w.__sealedStorageLeak = true; return store.call(this, k, v); };
    const start = AudioBufferSourceNode.prototype.start; w.__sealedAudio = [];
    AudioBufferSourceNode.prototype.start = function(...args) { w.__sealedAudio.push(this.buffer?.length); return start.apply(this, args); };
  });
  const page = await context.newPage(); let leak = false; const errors: string[] = [], requests: string[] = [];
  page.on("request", r => { if (/cbsk1-|PUBLIC_TEST_ONLY_SEALED_|TEST_ONLY_PRIVATE_/.test(r.url() + (r.postData() ?? ""))) leak = true; requests.push(r.method() + " " + r.url()); });
  page.on("console", m => { if (/cbsk1-|PUBLIC_TEST_ONLY_SEALED_|TEST_ONLY_PRIVATE_/.test(m.text())) leak = true; });
  page.on("pageerror", e => errors.push(e.name));
  return { context, page, audit: async () => ({ leak, errors, requests, storageLeak: await page.evaluate(() => (window as any).__sealedStorageLeak) }) };
}
async function download(p: Page, path: string, name = "Download sealed file") {
  const wait = p.waitForEvent("download"); await button(p, name).click(); const result = await wait; await result.saveAs(path);
  return { bytes: await readFile(path), name: result.suggestedFilename() };
}
async function finalize(p: Page, turn: string, message: string) {
  await region(p).getByLabel("Message to include", { exact: true }).fill(message);
  await region(p).getByLabel("Display alias (optional)").fill("PUBLIC TEST ONLY person");
  await region(p).getByLabel("Style label (optional)").fill("PUBLIC TEST ONLY style");
  await button(p, `Finalize ${turn}`).click(); await expect(region(p).getByTestId("outgoing-draft")).toHaveCount(0);
}
async function seal(p: Page, dir: string, name: string) {
  await button(p, "Prepare sealed file").click();
  await expect(region(p).getByLabel("Opening key", { exact: true })).toHaveAttribute("type", "password");
  const openingCode = await region(p).getByLabel("Opening key", { exact: true }).inputValue();
  expect(/^cbsk1-[A-Za-z0-9_-]{43}$/.test(openingCode)).toBe(true);
  await expect(button(p, "Download sealed file")).toBeDisabled();
  await region(p).getByLabel("I have saved the opening key", { exact: true }).check();
  const file = `${name}.coda.sealed.json`, expected = `${name}.PUBLIC-TEST-ONLY.json`;
  const actual = await download(p, `${dir}/${file}`);
  const original = Buffer.from(await p.evaluate(() => { const w = window as any, result = w.__sealedInputs.pop(); w.__sealedInputs.length = 0; return result; }));
  expect(decryptArtifact(actual.bytes, openingCode).equals(original)).toBe(true);
  expect(original.includes("TEST_ONLY_PRIVATE_")).toBe(false);
  await writeFile(`${dir}/${expected}`, original);
  return { file, expected, openingCode, bytes: actual.bytes, plain: JSON.parse(original.toString()), name: actual.name };
}
async function maskedCapture(p: Page, path: string) {
  const shown = region(p).getByLabel("Opening key", { exact: true });
  if (await shown.count()) { if (await shown.getAttribute("type") === "text") await button(p, "Hide opening key").click(); }
  await p.screenshot({ path });
}

test("unsupported crypto leaves a truthful locked preview with no content or export", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window.crypto.subtle, "decrypt", { value: undefined }); });
  await entry(page); await open(page, fixture);
  await expect(region(page)).toHaveAttribute("data-mode", "locked");
  await expect(region(page).getByRole("alert")).toContainText("native Web Crypto are required");
  await expect(button(page, "Unlock file")).toBeDisabled();
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(0);
  await expect(button(page, "Export unencrypted copy")).toHaveCount(0);
  await expect(button(page, "Download coda JSON")).toHaveCount(0);
});

test("real Web Crypto isolated A1/B1/A2 sealed files, private Composer preservation, lock/reopen and cold C reply", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const dir = `test-results/sealed-coda/${info.project.name}`; await mkdir(dir, { recursive: true });
  const A = await profile(browser, info), B = await profile(browser, info), C = await profile(browser, info);
  try {
    const beforeA = await installPrivate(A.page, "A"), beforeB = await installPrivate(B.page, "B");
    await region(A.page).getByLabel("File protection").selectOption("sealed"); await button(A.page, "Start a transmission").click();
    await expect(region(A.page).getByLabel("Message to include")).toHaveAttribute("spellcheck", "false");
    await finalize(A.page, "A1", "PUBLIC_TEST_ONLY_SEALED_A1 · A note across the water. 🌊");
    const a1 = await seal(A.page, dir, "A1");
    const repeat = await download(A.page, `${dir}/A1-repeat.coda.sealed.json`); expect(repeat.bytes.equals(a1.bytes)).toBe(true);
    await maskedCapture(A.page, `${dir}/A1-prepared.png`); await privateUnchanged(A.page, beforeA);
    await open(B.page, `${dir}/${a1.file}`); await expect(region(B.page).getByTestId("exchange-turn")).toHaveCount(0);
    await expect(region(B.page)).toHaveAttribute("data-mode", "locked");
    expect(await region(B.page).innerText()).not.toContain("PUBLIC_TEST_ONLY_SEALED_A1");
    await maskedCapture(B.page, `${dir}/locked.png`);
    await unlock(B.page, wrong); await expect(region(B.page).getByRole("alert")).toContainText("wrong key or damaged file"); await expect(region(B.page).getByTestId("exchange-turn")).toHaveCount(0);
    await unlock(B.page, a1.openingCode); await expect(region(B.page).getByTestId("exchange-turn")).toHaveCount(1);
    await button(B.page, "Play A1 only").click(); await expect(region(B.page).getByTestId("exchange-turn")).toHaveClass(/is-playing/); await button(B.page, "Stop Exchange audio").click();
    await button(B.page, "Reply with my style").click(); await finalize(B.page, "B1", "PUBLIC_TEST_ONLY_SEALED_B1 · My own timing. 안녕");
    const b1 = await seal(B.page, dir, "A1-B1"); expect(b1.plain.turns[0]).toEqual(a1.plain.turns[0]); await privateUnchanged(B.page, beforeB, true);
    await receive(A.page, `${dir}/${b1.file}`, b1.openingCode, 2);
    await button(A.page, "Reply with my style").click(); await finalize(A.page, "A2", "PUBLIC_TEST_ONLY_SEALED_A2 · This file includes our complete history.");
    const a2 = await seal(A.page, dir, "A1-B1-A2"); expect(a2.plain.turns.slice(0, 2)).toEqual(b1.plain.turns);
    expect(new Set([a1.openingCode, b1.openingCode, a2.openingCode]).size).toBe(3);
    expect(new Set([a1, b1, a2].map(v => JSON.parse(v.bytes.toString()).iv)).size).toBe(3);
    for (const [earlier, next] of [[a1, b1], [b1, a2]]) { let failed = false; try { decryptArtifact(next.bytes, earlier.openingCode); } catch { failed = true; } expect(failed).toBe(true); }
    await button(A.page, "Play complete exchange").click();
    for (let i = 0; i < 3; i++) await expect(region(A.page).getByTestId("exchange-turn").nth(i)).toHaveClass(/is-playing/);
    await expect(region(A.page).locator(".exchange-sound")).toContainText("stopped");
    await A.page.evaluate(() => scrollTo(0, 0)); await maskedCapture(A.page, `${dir}/final-unlocked.png`);
    await region(A.page).getByTestId("exchange-turn").first().scrollIntoViewIfNeeded(); await maskedCapture(A.page, `${dir}/unlocked-turns.png`);
    await button(A.page, "Reply with my style").click(); await region(A.page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_UNSAVED");
    await button(A.page, "Lock and forget key").click(); await keep(A.page); await expect(region(A.page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_UNSAVED");
    await button(A.page, "Lock and forget key").click(); await accept(A.page, "Discard unsaved work and lock");
    await expect(region(A.page)).toHaveAttribute("data-mode", "locked");
    await expect(region(A.page).getByLabel("Opening code", { exact: true })).toBeFocused();
    await maskedCapture(A.page, `${dir}/locked-after-discard.png`);
    expect(await region(A.page).innerHTML()).not.toContain("PUBLIC_TEST_ONLY_SEALED_");
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(0); await expect(button(A.page, "Export unencrypted copy")).toHaveCount(0);
    expect(await region(A.page).getByLabel("Opening code").inputValue() === "").toBe(true);
    await unlock(A.page, wrong); await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(0); await unlock(A.page, a2.openingCode);
    await expect(region(A.page).getByTestId("exchange-turn")).toHaveCount(3);
    const relocked = await download(A.page, `${dir}/reunlocked.coda.sealed.json`); expect(relocked.bytes.equals(a2.bytes)).toBe(true);
    await privateUnchanged(A.page, beforeA, true);
    await entry(C.page); await receive(C.page, `${dir}/${a2.file}`, a2.openingCode, 3);
    expect(await storage(C.page)).toBe(null);
    const reopened = await download(C.page, `${dir}/fresh-reopened.coda.sealed.json`); expect(reopened.bytes.equals(a2.bytes)).toBe(true);
    await C.page.setViewportSize({ width: 320, height: 844 }); await C.page.evaluate(() => scrollTo(0, 0));
    await maskedCapture(C.page, `${dir}/320px.png`);
    expect(await C.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await C.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await maskedCapture(C.page, `${dir}/320px-enlarged.png`);
    await region(C.page).getByTestId("exchange-turn").first().getByText(/numeric timing/).click(); await maskedCapture(C.page, `${dir}/320px-enlarged-timing.png`);
    expect(await C.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await region(C.page).getByLabel("Pattern for this turn").selectOption("seed:dswp-11"); await button(C.page, "Reply with my style").click();
    await finalize(C.page, "B2", "PUBLIC_TEST_ONLY_SEALED_COLD_REPLY · Supported seed, no Composer required."); const cold = await seal(C.page, dir, "cold-reply");
    await maskedCapture(C.page, `${dir}/320px-enlarged-key.png`);
    expect(cold.plain.turns.slice(0, 3)).toEqual(a2.plain.turns); expect(cold.plain.turns[3].phrase.blocks[0].source.recordingId).toBe("dswp-11");
    await C.page.reload(); await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(0);
    await open(C.page, `${dir}/${a2.file}`); await expect(region(C.page)).toHaveAttribute("data-mode", "locked"); await expect(region(C.page).getByTestId("exchange-turn")).toHaveCount(0);
    // Separate, fresh explicit plaintext export branch; never part of sending.
    await button(A.page, "Export unencrypted copy").click(); await keep(A.page);
    await button(A.page, "Export unencrypted copy").click(); const plainWait = A.page.waitForEvent("download"); await accept(A.page, "Download this unencrypted JSON"); const plainDownload = await plainWait; await plainDownload.saveAs(`${dir}/explicit-unencrypted-copy.coda.json`);
    expect((await readFile(`${dir}/explicit-unencrypted-copy.coda.json`)).equals(decryptArtifact(a2.bytes, a2.openingCode))).toBe(true);
    await expect(region(A.page)).toHaveAttribute("data-mode", "private");
    await button(A.page, "Export audible WAV (not encrypted)").click(); const wavWait = A.page.waitForEvent("download"); await accept(A.page, "Download this unencrypted WAV"); await (await wavWait).saveAs(`${dir}/explicit-unencrypted-audio.wav`);
    const entries = [a1, b1, a2, cold].map((x, i) => ({ file: x.file, expected: x.expected, openingCode: x.openingCode, prefix: i > 0 }));
    await writeFile(`${dir}/PUBLIC-TEST-ONLY-keys.json`, JSON.stringify({ label: manifest.label, entries }, null, 2) + "\n");
    const audits = await Promise.all([A.audit(), B.audit(), C.audit()]); expect(audits.every(x => !x.leak && !x.storageLeak && !x.errors.length)).toBe(true);
    await writeFile(`${dir}/round-trip.json`, JSON.stringify({ label: "PUBLIC TEST ONLY real Web Crypto; keys are in the separate explicit fixture", browser: browser.version(), isolatedContexts: 3, priorTurnsExact: true, stableDownloads: true, freshKeysAndIVs: true, privateComposer: { A: hash(beforeA), B: hash(beforeB), preserved: true }, lockedDomCleared: true, originalReloadRequiresKey: true, nativeShareDelivery: "not tested", humanListening: "not performed", audits }, null, 2) + "\n");
  } finally { await Promise.all([A.context.close(), B.context.close(), C.context.close()]); }
});

test("independent fixture, same-digest downgrade prevention, explicit export expiry and private intent before writing", async ({ page }) => {
  await entry(page); await receive(page, fixture, code, 1);
  await button(page, "Reply with my style").click(); await region(page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_PENDING");
  await open(page, originalPlain); await expect(region(page)).toHaveAttribute("data-mode", "private"); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_PENDING");
  await expect(button(page, "Download coda JSON")).toHaveCount(0); await expect(button(page, "Download Exchange WAV")).toHaveCount(0); await expect(button(page, "Download sealed file")).toHaveCount(0);
  await open(page, fixture); await expect(region(page).getByTestId("outgoing-draft")).toHaveCount(1);
  await workspaceView(page, "Listen"); await workspaceView(page, "Exchange"); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_PENDING");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_PENDING");
  await button(page, "Cancel outgoing draft").click(); await accept(page);
  await button(page, "Export unencrypted copy").click(); await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
  await button(page, "Export unencrypted copy").click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(region(page)).toHaveAttribute("data-mode", "locked");
  expect(await region(page).innerHTML()).not.toContain("TEST ONLY 🌊"); await expect(button(page, "Download sealed file")).toHaveCount(0);
  await unlock(page); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
});

test("failed candidates preserve current work; malformed/header/encoding/inner-authentication errors install nothing", async ({ page }) => {
  await entry(page); await open(page, originalPlain); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
  await button(page, "Reply with my style").click(); await region(page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_KEEP");
  await open(page, fixture); await unlock(page, wrong); await expect(region(page).getByRole("alert")).toContainText("wrong key or damaged"); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_KEEP");
  await button(page, "Cancel candidate").click(); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
  for (const bytes of [Buffer.from("{"), Buffer.from(JSON.stringify({ ...JSON.parse(fixture.toString()), version: 2 })), Buffer.from(JSON.stringify({ ...JSON.parse(fixture.toString()), iv: "invalid=" })), Buffer.alloc(1048577)]) {
    await open(page, bytes); await expect(region(page).getByRole("alert")).toBeVisible(); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_KEEP");
  }
  const badInner = encryptPublicFixture(Buffer.from('{"message":"PUBLIC_TEST_ONLY_SEALED_INVALID_INNER"}'), Buffer.alloc(32, 23), Buffer.alloc(12, 41));
  await open(page, badInner); await unlock(page); await expect(region(page).getByRole("alert")).toContainText("wrong key or damaged"); expect(await region(page).innerHTML()).not.toContain("PUBLIC_TEST_ONLY_SEALED_INVALID_INNER");
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
});

test("key copy denial/manual fallback, ciphertext-only share cancellation and visibility preserve unfinished work", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.__shares = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new DOMException("denied", "NotAllowedError"); } } });
    Object.defineProperty(navigator, "canShare", { value: (v: ShareData) => v.files?.[0] instanceof File });
    Object.defineProperty(navigator, "share", { value: async (v: ShareData) => { w.__shares.push({ keys: Object.keys(v), text: v.text, file: await v.files![0].text(), name: v.files![0].name }); document.dispatchEvent(new Event("visibilitychange")); throw new DOMException("cancelled", "AbortError"); } });
  });
  await entry(page); await open(page, originalPlain); await button(page, "Seal this finalized exchange").click(); await button(page, "Prepare sealed file").click();
  await button(page, "Copy opening key").click(); await expect(region(page).getByRole("alert")).toContainText("copy manually"); await expect(region(page).getByLabel("Opening key", { exact: true })).toHaveAttribute("type", "text");
  await button(page, "Select opening key").click(); expect(await region(page).getByLabel("Opening key", { exact: true }).evaluate((n: HTMLInputElement) => n.selectionEnd === n.value.length && n.selectionStart === 0)).toBe(true);
  await button(page, "Hide opening key").click(); await region(page).getByLabel("I have saved the opening key").check();
  let downloads = 0; page.on("download", () => downloads++); await button(page, "Share sealed file").click(); await expect(region(page).getByRole("status").first()).toContainText("Share cancelled");
  const shared = await page.evaluate(() => (window as any).__shares); expect(shared.length).toBe(1); expect(shared[0].keys).toEqual(["files"]); expect(JSON.parse(shared[0].file).format).toBe("codabridge-sealed"); expect(shared[0].file.includes("cbsk1-")).toBe(false); expect(downloads).toBe(0);
  await button(page, "Reply with my style").click(); await region(page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_NOTE");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await expect(region(page).getByLabel("Message to include")).toHaveValue("PUBLIC_TEST_ONLY_SEALED_NOTE"); await expect(button(page, "Share sealed file")).toHaveCount(0);
});

for (const failure of ["rng", "encrypt", "unsupported"] as const) test(`private ${failure} failure keeps draft/history and never prepares plaintext fallback`, async ({ page }) => {
  await entry(page); await open(page, originalPlain); await button(page, "Seal this finalized exchange").click();
  await page.evaluate(failure => {
    if (failure === "rng") crypto.getRandomValues = () => { throw new Error("TEST ONLY failure"); };
    if (failure === "encrypt") crypto.subtle.encrypt = async () => { throw new Error("TEST ONLY failure"); };
    if (failure === "unsupported") Object.defineProperty(window, "isSecureContext", { value: false });
  }, failure);
  if (failure === "unsupported") { await workspaceView(page, "Listen"); await workspaceView(page, "Exchange"); await expect(button(page, "Prepare sealed file")).toBeDisabled(); }
  else { await button(page, "Prepare sealed file").click(); await expect(region(page).getByRole("alert")).toContainText("no plaintext file"); }
  await expect(region(page)).toHaveAttribute("data-mode", "private"); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1); await expect(button(page, "Download coda JSON")).toHaveCount(0); await expect(button(page, "Download sealed file")).toBeDisabled();
});

for (const delayed of ["encrypt", "decrypt", "read", "hash", "clipboard", "audio"] as const) test(`lock invalidates delayed ${delayed} and prevents stale content, key, status or export restoration`, async ({ page }) => {
  await entry(page); await receive(page, fixture, code, 1);
  if (delayed === "clipboard") { await button(page, "Create a new seal").click(); await region(page).getByLabel("I have saved the opening key").check(); }
  if (delayed === "decrypt") await button(page, "Lock and forget key").click();
  await page.evaluate(delayed => {
    const w = window as any; w.__blocked = false; w.__completed = 0;
    const gate = () => w.__releasedSealed ? Promise.resolve() : new Promise<void>(r => { w.__blocked = true; w.__releaseSealed = () => { w.__releasedSealed = true; r(); }; });
    if (delayed === "encrypt" || delayed === "decrypt" || delayed === "hash") {
      const method = delayed === "hash" ? "digest" : delayed, original = (crypto.subtle[method] as Function).bind(crypto.subtle);
      (crypto.subtle as any)[method] = async (...args: any[]) => { await gate(); try { return await original(...args); } finally { w.__completed++; } };
    } else if (delayed === "read") { const original = File.prototype.arrayBuffer; File.prototype.arrayBuffer = async function() { await gate(); try { return await original.call(this); } finally { w.__completed++; } }; }
    else if (delayed === "clipboard") Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { await gate(); w.__completed++; } } });
    else { const original = AudioContext.prototype.resume; AudioContext.prototype.resume = async function() { await gate(); try { return await original.call(this); } finally { w.__completed++; } }; }
  }, delayed);
  if (delayed === "encrypt") await button(page, "Create a new seal").click();
  else if (delayed === "decrypt") await unlock(page);
  else if (delayed === "read") await open(page, originalPlain);
  else if (delayed === "hash") { await button(page, "Reply with my style").click(); await region(page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_LATE"); await button(page, "Finalize B1").click(); }
  else if (delayed === "clipboard") await button(page, "Copy opening key").click();
  else await button(page, "Play complete exchange").click();
  await expect.poll(() => page.evaluate(() => (window as any).__blocked)).toBe(true);
  if (delayed === "decrypt") await button(page, "Cancel unlock and stay locked").click();
  else { await button(page, "Lock and forget key").click(); if (await page.getByRole("dialog").isVisible()) await accept(page, "Discard unsaved work and lock"); }
  // Release once and restore each wrapper, so additional digest operations run.
  await page.evaluate(() => (window as any).__releaseSealed()); await expect.poll(() => page.evaluate(() => (window as any).__completed > 0)).toBe(true); await page.waitForTimeout(150);
  await expect(region(page)).toHaveAttribute("data-mode", "locked"); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(0);
  await expect(region(page).getByTestId("outgoing-draft")).toHaveCount(0); await expect(region(page).getByLabel("Opening key", { exact: true })).toHaveCount(0); await expect(button(page, "Download sealed file")).toHaveCount(0);
  expect(await region(page).innerHTML()).not.toContain("PUBLIC_TEST_ONLY_SEALED_LATE"); expect(await region(page).innerText()).not.toContain("copied");
});

test("double preparation, reseal and arrangement bind the matching fresh key; lock revokes owned download URLs", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.__rng = []; w.__urls = new Set(); w.__downloadURLs = new Set();
    const rng = crypto.getRandomValues.bind(crypto), create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    crypto.getRandomValues = ((b: Uint8Array<ArrayBuffer>) => { w.__rng.push(b.length); return rng(b); }) as typeof crypto.getRandomValues;
    URL.createObjectURL = b => { const value = create(b); w.__urls.add(value); return value; };
    URL.revokeObjectURL = value => { w.__urls.delete(value); revoke(value); };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() { if (this.download) w.__downloadURLs.add(this.href); return click.call(this); };
  });
  await entry(page); await receive(page, fixture, code, 1);
  // Same event turn: the synchronous session latch must reject the second job.
  await button(page, "Create a new seal").evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(region(page).getByLabel("Opening key", { exact: true })).toBeVisible();
  const first = await region(page).getByLabel("Opening key", { exact: true }).inputValue();
  expect(await page.evaluate(() => (window as any).__rng)).toEqual([32, 12]);
  await region(page).getByLabel("I have saved the opening key").check();
  await button(page, "Create a new seal").click(); await expect(region(page).getByLabel("I have saved the opening key")).not.toBeChecked();
  expect(await region(page).getByLabel("Opening key", { exact: true }).inputValue() === first).toBe(false);
  await region(page).getByLabel("I have saved the opening key").check();
  await button(page, "Reply with my style").click(); await finalize(page, "B1", "PUBLIC_TEST_ONLY_SEALED_ARRANGED"); await button(page, "Prepare sealed file").click(); await region(page).getByLabel("I have saved the opening key").check();
  const gap = region(page).getByLabel("Gap after A1 (seconds)"); await gap.fill("0.8"); await gap.locator("xpath=ancestor::form").getByRole("button", { name: "Set", exact: true }).click();
  await expect(region(page).getByLabel("Opening key", { exact: true })).toHaveCount(0); await expect(button(page, "Download sealed file")).toBeDisabled(); await button(page, "Prepare sealed file").click(); await region(page).getByLabel("I have saved the opening key").check();
  await button(page, "Export unencrypted copy").click(); const requested = page.waitForEvent("download"); await accept(page, "Download this unencrypted JSON"); await requested;
  await button(page, "Lock and forget key").click();
  expect(await page.evaluate(() => [...(window as any).__downloadURLs].filter(u => (window as any).__urls.has(u)).length)).toBe(0); await expect(region(page)).toHaveAttribute("data-mode", "locked");
});

test("keyboard unlock, real page leave/back and empty private lock require explicit return to content", async ({ page }) => {
  await entry(page); await open(page, fixture); await region(page).getByLabel("Opening code", { exact: true }).fill(code);
  await page.keyboard.press("Enter"); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
  await button(page, "Lock and forget key").focus(); await page.keyboard.press("Enter"); await expect(region(page)).toHaveAttribute("data-mode", "locked"); await expect(region(page).getByLabel("Opening code", { exact: true })).toBeFocused();
  await unlock(page); await expect(region(page).getByTestId("exchange-turn")).toHaveCount(1);
  await page.goto("about:blank"); await page.goBack(); await expect(region(page)).toBeVisible();
  await expect(region(page).getByTestId("exchange-turn")).toHaveCount(0); await expect(region(page).getByLabel("Opening key", { exact: true })).toHaveCount(0);
  if (await region(page).getAttribute("data-mode") === "locked") { await button(page, "Reset Exchange").click(); await accept(page); }
  await region(page).getByLabel("File protection").selectOption("sealed"); await button(page, "Start a transmission").click();
  await region(page).getByLabel("Message to include").fill("PUBLIC_TEST_ONLY_SEALED_NOT_YET_ENCRYPTED"); await button(page, "Lock and forget key").click(); await accept(page, "Discard unsaved work and lock");
  await expect(region(page)).toContainText("No encrypted snapshot was retained"); await expect(region(page).getByLabel("Opening code")).toHaveCount(0);
});

for (const outcome of ["success", "rejected", "unsupported"] as const) test(`private optional share ${outcome} has no plaintext/key fallback or false delivery claim`, async ({ page }) => {
  await page.addInitScript(outcome => {
    Object.defineProperty(navigator, "canShare", { value: (v: ShareData) => outcome !== "unsupported" && v.files?.[0] instanceof File });
    Object.defineProperty(navigator, "share", { value: async (v: ShareData) => { if (Object.keys(v).join() !== "files") throw new Error("unexpected payload"); if (outcome === "rejected") throw new DOMException("denied", "NotAllowedError"); } });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { (window as any).__publicCopiedKey = value; } } });
  }, outcome);
  await entry(page); await receive(page, fixture, code, 1); let downloads = 0; page.on("download", () => downloads++);
  if (outcome === "unsupported") await expect(button(page, "Share sealed file")).toBeDisabled();
  else {
    await button(page, "Share sealed file").click();
    if (outcome === "success") await expect(region(page).getByRole("status").first()).toContainText("Recipient delivery and reading are unknown");
    else await expect(region(page).getByRole("alert")).toContainText("Sharing could not complete");
  }
  expect(downloads).toBe(0); await expect(region(page)).toHaveAttribute("data-mode", "private"); await expect(button(page, "Download sealed file")).toBeEnabled();
  if (outcome === "success") {
    await button(page, "Create a new seal").click(); await button(page, "Copy opening key").click();
    await expect(region(page).getByRole("status").first()).toContainText("Opening key copied");
    expect(await region(page).getByLabel("Opening key", { exact: true }).evaluate((n: HTMLInputElement) => { const same = n.value === (window as any).__publicCopiedKey; delete (window as any).__publicCopiedKey; return same; })).toBe(true);
    await expect(region(page).getByLabel("I have saved the opening key")).not.toBeChecked(); await expect(button(page, "Download sealed file")).toBeDisabled();
  }
});
