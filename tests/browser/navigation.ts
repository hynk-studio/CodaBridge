import { type Page } from "@playwright/test";

// Real visible navigation, shared by the pre-polish regression journeys.
// Reads and semantic assertions still inspect the same underlying evidence.
export async function workspaceView(page: Page, name: "Listen" | "Composer" | "Context Lab" | "Exchange") {
  const switcher = page.getByRole("combobox", { name: "Workspace", exact: true });
  if (await switcher.isVisible()) {
    const id = { Listen: "listen", Composer: "composer", "Context Lab": "lab", Exchange: "exchange" }[name];
    if (await switcher.inputValue() !== id) await switcher.selectOption(id);
  } else {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  }
}
export async function composerView(page: Page, view: "edit" | "compare" | "save") {
  await workspaceView(page, "Composer");
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
  await workspaceView(page, "Context Lab");
  const name = { explore: "Explore exchange", compare: "Compare pairings", save: "Save investigation" }[view];
  const step = page.getByRole("button", { name, exact: true });
  if (await step.getAttribute("aria-pressed") !== "true") await step.click();
  return page;
}
export async function listenView(page: Page) {
  await workspaceView(page, "Listen");
  return page;
}
export async function disclosure(page: Page, selector: string) {
  const target = page.locator(selector);
  if (await target.isVisible() && await target.getAttribute("open") === null) await target.locator("summary").first().click();
}
