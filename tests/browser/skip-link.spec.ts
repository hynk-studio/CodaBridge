import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { STORAGE_KEY } from "../../src/composer/project.ts";
import { workspaceView } from "./navigation.ts";

// Every test owns a fresh browser context. Never inspect an owner's storage or
// clipboard. Prepared TEST ONLY keys stay masked and out of failure artifacts.
test.use({ trace: "off", screenshot: "off", video: "off" });
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const exchange = (page: Page) => page.getByTestId("exchange");
const action = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function skipWithKeyboard(page: Page) {
  const skip = page.getByRole("link", { name: "Skip to workspace", exact: true });
  const url = page.url(), entries = await page.evaluate(() => history.length);
  // Traverse the actual tab order, including compact mobile navigation. Do not
  // call focus(), click(), dispatchEvent(), or an application function to skip.
  for (let i = 0; i < 100 && !await skip.evaluate(n => n === document.activeElement); i++) {
    await page.keyboard.press("Shift+Tab");
  }
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  const top = await page.getByRole("main").evaluate(n => n.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(page.viewportSize()!.height / 2);
}

async function makeNote(page: Page, sealed = false) {
  await page.goto("/#exchange");
  await action(page, "Create a new message").click();
  if (sealed) await exchange(page).getByLabel("File protection", { exact: true }).selectOption("sealed");
  await action(page, "Write a note").click();
  await exchange(page).getByLabel("Message to include").fill("PUBLIC TEST ONLY · keep this unfinished note 안녕 🐋");
}

test("skip link retains Composer draft, selected block and Undo/Redo through keyboard activation", async ({ page }) => {
  await page.goto("/");
  await action(page, "Make my coda").click();
  await action(page, "Duplicate block").click();
  await action(page, "Lengthen ×1.25").click();
  await action(page, "Undo").click();
  const draft = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await expect(page.getByRole("button", { name: /^Block 2/ })).toHaveAttribute("aria-pressed", "true");
  await skipWithKeyboard(page);
  await expect(page.getByRole("region", { name: "Active block editor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Block 2/ })).toHaveAttribute("aria-pressed", "true");
  await expect(action(page, "Undo")).toBeEnabled();
  await expect(action(page, "Redo")).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(draft);
});

test("skip link retains Context Lab mode and selected Atlas reference", async ({ page }) => {
  await page.goto("/#context-lab");
  await action(page, "Timing / Style Atlas").click();
  await page.getByLabel("Atlas click count", { exact: true }).selectOption("6");
  await action(page, "Next row").click();
  const row = await page.getByTestId("atlas-selected").getAttribute("data-source-row");
  await skipWithKeyboard(page);
  await expect(action(page, "Timing / Style Atlas")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("style-atlas")).toBeVisible();
  await expect(page.getByTestId("atlas-selected")).toHaveAttribute("data-source-row", row!);
});

for (const stage of ["rhythm", "review"]) test(`skip link retains unfinished Exchange note in ${stage} without finalizing or leaving`, async ({ page }) => {
  await makeNote(page);
  if (stage === "review") await action(page, "Review message").click();
  await skipWithKeyboard(page);
  await expect(exchange(page)).toBeVisible();
  await expect(exchange(page)).toHaveAttribute("data-screen", stage);
  await expect(exchange(page)).toHaveAttribute("data-mode", "plain");
  await expect(exchange(page)).toHaveAttribute("data-composing", "true");
  await expect(exchange(page).getByTestId("exchange-turn")).toHaveCount(0);
  if (stage === "review") await action(page, "Back to note").click();
  await expect(exchange(page).getByLabel("Message to include")).toHaveValue("PUBLIC TEST ONLY · keep this unfinished note 안녕 🐋");
});

test("skip link preserves a prepared sealed file, masked key and both acknowledgement states", async ({ page }) => {
  await makeNote(page, true);
  await action(page, "Review message").click();
  await action(page, "Finalize A1").click();
  await action(page, "Prepare sealed file").click();
  const key = exchange(page).getByLabel("Opening key", { exact: true });
  await expect(key).toBeVisible();
  const retained = await key.inputValue();
  const identity = await exchange(page).locator(".sealed-file-identity code").textContent();
  const acknowledgement = exchange(page).getByLabel("I have saved the opening key", { exact: true });
  await skipWithKeyboard(page);
  await expect(acknowledgement).not.toBeChecked();
  await expect(action(page, "Download sealed file")).toBeDisabled();
  expect(await key.inputValue() === retained).toBe(true);
  await expect(key).toHaveAttribute("type", "password");
  await acknowledgement.check();
  const firstEvent = page.waitForEvent("download"); await action(page, "Download sealed file").click();
  const first = await firstEvent, originalBytes = await readFile((await first.path())!);
  await skipWithKeyboard(page);
  await expect(exchange(page)).toHaveAttribute("data-screen", "handoff");
  await expect(exchange(page)).toHaveAttribute("data-mode", "private");
  await expect(exchange(page)).toHaveAttribute("data-composing", "false");
  await expect(acknowledgement).toBeChecked();
  await expect(key).toHaveAttribute("type", "password");
  expect(await key.inputValue() === retained).toBe(true);
  await expect(exchange(page).locator(".sealed-file-identity code")).toHaveText(identity!);
  const secondEvent = page.waitForEvent("download"); await action(page, "Download sealed file").click();
  const second = await secondEvent;
  expect(second.suggestedFilename()).toBe(first.suggestedFilename());
  expect((await readFile((await second.path())!)).equals(originalBytes)).toBe(true);
});

test("skip adds no entries to real workspace Back/Forward; wordmark and home shortcuts still work", async ({ page }) => {
  await page.goto("/");
  await action(page, "Make my coda").click(); await skipWithKeyboard(page);
  await workspaceView(page, "Context Lab");
  await action(page, "Timing / Style Atlas").click(); await skipWithKeyboard(page);
  await workspaceView(page, "Exchange");
  await action(page, "Create a new message").click();
  await action(page, "Write a note").click();
  await exchange(page).getByLabel("Message to include").fill("PUBLIC TEST ONLY history note");
  await skipWithKeyboard(page);
  await page.goBack(); await expect(page).toHaveURL(/#context-lab$/); await expect(page.getByTestId("style-atlas")).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/#composer$/); await expect(page.locator("#composer")).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/\/$/); await expect(action(page, "Make my coda")).toBeVisible();
  await page.goForward(); await expect(page).toHaveURL(/#composer$/);
  await page.goForward(); await expect(page).toHaveURL(/#context-lab$/); await expect(page.getByTestId("style-atlas")).toBeVisible();
  await page.goForward(); await expect(page).toHaveURL(/#exchange$/);
  await expect(exchange(page)).toHaveAttribute("data-screen", "rhythm");
  await expect(exchange(page).getByLabel("Message to include")).toHaveValue("PUBLIC TEST ONLY history note");
  await page.getByRole("link", { name: "CodaBridge home", exact: true }).press("Enter");
  await expect(page).toHaveURL(/#listen$/);
  await action(page, "Open a coda file").click();
  await expect(exchange(page).getByLabel("Choose coda file", { exact: true })).toBeVisible();
  await action(page, "Continue your unfinished message").click();
  await expect(exchange(page).getByLabel("Message to include")).toHaveValue("PUBLIC TEST ONLY history note");
});

test("supported direct workspace hashes and same-document focus anchors remain distinct", async ({ page }) => {
  for (const [hash, selector] of [["listen", ".quick-start"], ["composer", "#composer"], ["context-lab", ".context-lab"], ["exchange", ".exchange"]]) {
    await page.goto(`/#${hash}`);
    await expect(page.locator(selector)).toBeVisible();
    await skipWithKeyboard(page);
  }
  await workspaceView(page, "Composer");
  // An external in-page fragment is not a supported workspace route either.
  await page.goto("/#workspace");
  await expect(page.locator("#composer")).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
});
