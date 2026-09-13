import { type Page } from "@playwright/test";

// Real visible navigation, shared by the pre-polish regression journeys.
// Reads and semantic assertions still inspect the same underlying evidence.
export async function composerView(page: Page, view: "edit" | "compare" | "save") {
  const workspace = page.getByRole("button", { name: "Composer", exact: true });
  if (await workspace.getAttribute("aria-pressed") !== "true") await workspace.click();
  const name = { edit: "Edit phrase", compare: "Compare & ask", save: "Save & codebook" }[view];
  const step = page.getByRole("button", { name, exact: true });
  if (await step.isVisible() && await step.getAttribute("aria-pressed") !== "true") await step.click();
  if (view === "edit") {
    await disclosure(page, ".phrase-properties");
    await disclosure(page, ".precise-timing");
  }
  return page;
}
export async function labView(page: Page, view: "explore" | "compare" | "save") {
  const workspace = page.getByRole("button", { name: "Context Lab", exact: true });
  if (await workspace.getAttribute("aria-pressed") !== "true") await workspace.click();
  const name = { explore: "Explore exchange", compare: "Compare pairings", save: "Save investigation" }[view];
  const step = page.getByRole("button", { name, exact: true });
  if (await step.getAttribute("aria-pressed") !== "true") await step.click();
  return page;
}
export async function listenView(page: Page) {
  const workspace = page.getByRole("button", { name: "Listen", exact: true });
  if (await workspace.getAttribute("aria-pressed") !== "true") await workspace.click();
  return page;
}
export async function disclosure(page: Page, selector: string) {
  const target = page.locator(selector);
  if (await target.isVisible() && await target.getAttribute("open") === null) await target.locator("summary").first().click();
}
