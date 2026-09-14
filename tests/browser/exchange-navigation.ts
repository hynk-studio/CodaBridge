import { expect, type Page } from "@playwright/test";
import { disclosure } from "./navigation.ts";
const region = (page: Page) => page.getByTestId("exchange");
async function expand(page: Page, title: string) {
  const summary = region(page).getByText(title, { exact: true });
  if (await summary.locator("xpath=parent::details").getAttribute("open") === null) await summary.click();
}
const button = (page: Page, name: string) => region(page).getByRole("button", { name, exact: true });
// Visible stage navigation for legacy behavioral regressions. No application
// function calls or hidden clicks: each new stage is reached by its UI label.
export async function receiveArea(page: Page) {
  if (!await region(page).getByLabel("Choose coda file", { exact: true }).isVisible()) await button(page, "Open a coda file").click();
}
export async function conversation(page: Page) {
  if (await region(page).getAttribute("data-screen") !== "conversation") await button(page, "View / listen to conversation").first().click();
}
export async function setupMessage(page: Page) {
  if (await region(page).getAttribute("data-screen") === "setup") return;
  if (await region(page).getAttribute("data-has-turns") === "true") {
    if (await region(page).getAttribute("data-screen") === "handoff") {
      await expand(page, "More conversation options");
      await button(page, "Write another turn on this device").click();
    } else { await conversation(page); await button(page, "Reply").click(); }
  } else {
    if (await region(page).getAttribute("data-screen") !== "start") await button(page, "Exchange home").click();
    await button(page, "Create a new message").click();
  }
}
export async function exchangeAction(page: Page, name: string) {
  if (name === "Start a transmission" || name === "Reply with my style") { await setupMessage(page); await button(page, "Write a note").click(); return; }
  if (name.startsWith("Finalize ")) await button(page, "Review message").click();
  if (name === "Download coda JSON" || name === "Share file" || name === "Share sealed file" || name === "Download sealed file") {
    if (await region(page).getAttribute("data-screen") !== "handoff") { await conversation(page); await button(page, "Save and share this file").click(); }
    if (name === "Download coda JSON") name = "Download conversation file";
  }
  if (name === "Reset Exchange") await disclosure(page, ".exchange-retention");
  if (["Download Exchange WAV", "Export unencrypted copy", "Export audible WAV (not encrypted)", "Seal this finalized exchange"].includes(name)) {
    await conversation(page); await expand(page, "Conversation options & secondary exports");
  }
  if (name.startsWith("Play ") || name === "Stop Exchange audio") {
    if (!await button(page, name).isVisible()) await conversation(page);
  }
  if (name === "Prepare sealed file") await handoffView(page);
  if (name === "Create a new seal") {
    await handoffView(page);
    if (!await button(page, name).isVisible()) await region(page).getByText("Need a different seal?", { exact: true }).click();
  }
  await button(page, name).click();
}
export async function resumeNote(page: Page) {
  await expect(region(page)).toBeVisible();
  if (await region(page).getAttribute("data-screen") === "rhythm") { await expect(region(page).getByLabel("Message to include", { exact: true })).toBeVisible(); return; }
  const resume = region(page).getByRole("button", { name: /Continue your unfinished (reply|message)|Resume unfinished message/ }).first();
  if (await resume.isVisible()) await resume.click();
  else { await conversation(page); await button(page, "Continue your unfinished reply").click(); }
}
export async function handoffView(page: Page) {
  if (await region(page).getAttribute("data-screen") !== "handoff") { await conversation(page); await button(page, "Save and share this file").click(); }
}
