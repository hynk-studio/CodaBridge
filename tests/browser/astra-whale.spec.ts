import { test, expect, type Page, type Locator } from "@playwright/test";
import { createWorker } from "../../server/worker.ts";
import { TEST_ENV, happyTransport, finalOutput, scriptedTransport } from "../fixtures/provider.ts";
import { composerTransport } from "../fixtures/composer-provider.ts";
import { labTransport } from "../fixtures/lab-provider.ts";
import { composerView, disclosure, labView, workspaceView } from "./navigation.ts";
import { STORAGE_KEY, projectJson } from "../../src/composer/project.ts";
import { createDraft } from "../../src/composer/model.ts";

test.use({ video: { mode: "on", size: { width: 1440, height: 1000 } } });

type Surface = "edit" | "composer" | "lab" | "pair";
const surfaces: Surface[] = ["edit", "composer", "lab", "pair"];
const selectors = { edit: ".composer-astra", composer: ".composer-astra", lab: ".lab-ask", pair: ".investigation-panel" };
const endpoint = (surface: Surface) => surface === "pair" ? "/api/investigate" : surface === "lab" ? "/api/lab" : "/api/composer";
const area = (page: Page, surface: Surface) => page.locator(selectors[surface]);
const whale = (page: Page, surface: Surface) => area(page, surface).locator(".astra-activity");
const requestText = (page: Page, surface: Surface) => area(page, surface).getByRole("textbox");
const ask = (page: Page, surface: Surface) => area(page, surface).getByRole("button", {
  name: surface === "pair" ? "Investigate selection" : "Ask Astra", exact: true,
});

async function fixture(page: Page, surface: Surface, options: { unavailable?: boolean; zeroModel?: boolean; ignoreAbort?: boolean } = {}) {
  const mock = options.zeroModel ? scriptedTransport([finalOutput()])
    : surface === "pair" ? happyTransport()
    : surface === "lab" ? labTransport() : composerTransport();
  const state = { fail: false, delivered: 0, posts: [] as string[], requests: [] as string[], external: [] as string[] };
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const worker = createWorker({ transport: async (url, init) => {
    if (state.fail) throw new Error("TEST ONLY controlled failure");
    return mock.transport(url, init);
  } });
  page.on("request", request => {
    state.requests.push(request.url());
    if (request.method() === "POST") state.posts.push(new URL(request.url()).pathname);
  });
  // A failed local fixture must never fall through to a real provider/service.
  await page.route("**/*", async route => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:4173") {
      state.external.push(route.request().url());
      await route.abort();
    } else await route.fallback();
  });
  await page.route("**/api/**", async route => {
    const input = route.request();
    const response = await worker.fetch(new Request(input.url(), {
      method: input.method(), headers: input.headers(),
      ...(input.method() === "POST" ? { body: input.postData() } : {}),
    }), options.unavailable ? {} : TEST_ENV);
    if (input.method() === "POST") await gate;
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    if (input.method() === "POST") state.delivered++;
  });
  if (options.ignoreAbort) await page.addInitScript(() => {
    // TEST ONLY: allow a late HTTP response to arrive despite AbortController.
    // The real client's generation/binding/aborted checks must still reject it.
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.href).pathname;
      return original(input, /^\/api\/(composer|lab|investigate)$/.test(path)
        ? { ...init, signal: undefined } : init);
    };
  });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const badge = document.createElement("div");
    badge.textContent = "TEST ONLY · local provider fixture · no live Astra call";
    badge.style.cssText = "position:fixed;top:0;right:0;z-index:9999;background:#f5d89f;color:#17241b;padding:4px 8px;font:12px sans-serif;max-width:100%;pointer-events:none";
    document.body.append(badge);
  }));
  return { state, mock, release };
}

async function open(page: Page, surface: Surface) {
  await page.goto("/");
  if (surface === "pair") await disclosure(page, ".optional-investigation");
  else if (surface === "lab") await labView(page, "compare");
  else {
    await page.getByRole("button", { name: "Make my version · 1.wav", exact: true }).click();
    await composerView(page, "compare");
    if (surface === "composer") await page.getByLabel("Request type", { exact: true }).selectOption("investigate");
  }
  await whale(page, surface).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
}
async function animations(indicator: Locator) {
  return indicator.locator("svg > g").evaluateAll(groups => groups.map(group => getComputedStyle(group).animationName));
}
async function artSize(indicator: Locator) {
  return indicator.locator("svg").evaluate(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height }));
}

for (const surface of ["edit", "lab", "pair"] as const) {
  test(`whale ${surface}: unavailable is static and rendering sends no model request`, async ({ page }, info) => {
    const f = await fixture(page, surface, { unavailable: true });
    await open(page, surface);
    const indicator = whale(page, surface);
    await expect(indicator).toHaveAttribute("data-state", "unavailable");
    await expect(indicator).toContainText(/unavailable/i);
    await expect(ask(page, surface)).toBeDisabled();
    expect(await animations(indicator)).toEqual(["none", "none", "none"]);
    expect(f.state.posts).toEqual([]);
    expect(f.mock.calls).toHaveLength(0);
    expect(f.state.external).toEqual([]);
    expect(f.state.requests.some(url => /astra-whale-reference|\.png$/.test(url))).toBe(false);
    await page.screenshot({ path: info.outputPath("unavailable.png") });
  });
}

for (const surface of surfaces) {
  test(`whale ${surface}: ready, pending and accepted completion follow the request without new traffic`, async ({ page }) => {
    const f = await fixture(page, surface);
    await open(page, surface);
    const indicator = whale(page, surface);
    await expect(indicator).toHaveAttribute("data-state", "ready");
    expect(f.state.posts).toEqual([]);
    const shape = await indicator.locator(".astra-whale-body").innerHTML();
    const size = await artSize(indicator);
    expect(await animations(indicator)).toEqual(["none", "none", "none"]);
    await expect(indicator.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(indicator.locator("svg")).toHaveAttribute("focusable", "false");
    const response = page.waitForResponse(`**${endpoint(surface)}`);
    // Keyboard submission and focus retention remain independent of animation.
    await ask(page, surface).focus();
    await page.keyboard.press("Enter");
    await expect(indicator).toHaveAttribute("data-state", "pending");
    await expect(indicator).toContainText("Astra request in progress…");
    await expect(area(page, surface).locator(".astra-actions")).toHaveCount(0);
    await indicator.scrollIntoViewIfNeeded();
    await expect(indicator).toHaveAttribute("data-motion", "true");
    expect(await animations(indicator)).toEqual(["astra-float", "astra-shimmer", "none"]);
    const traffic = [...f.state.requests];
    await page.waitForTimeout(300); // Observe motion with a deliberately held TEST ONLY response.
    expect(f.state.requests).toEqual(traffic);
    await requestText(page, surface).focus();
    f.release();
    const accepted = await (await response).json();
    await expect(indicator).toHaveAttribute("data-state", "completed");
    await expect(indicator).toContainText(surface === "edit" ? "Proposal ready — review before applying" : "Answer ready");
    await expect(requestText(page, surface)).toBeFocused();
    expect((await animations(indicator)).slice(0, 2)).toEqual(["none", "none"]);
    expect(await artSize(indicator)).toEqual(size);
    expect(await indicator.locator(".astra-whale-body").innerHTML()).toBe(shape);
    const actions = area(page, surface).locator(".astra-actions");
    await actions.locator("summary").click();
    const expected = surface === "edit" ? ["Performed by CodaBridge"]
      : surface === "composer" ? ["Performed by CodaBridge", "Requested by Astra"]
      : surface === "lab" ? ["Performed by CodaBridge", "Performed by CodaBridge", "Requested by Astra"]
      : ["Performed by CodaBridge", "Performed by CodaBridge", "Performed by CodaBridge", "Requested by Astra"];
    expect(await actions.locator("li > span").allTextContents()).toEqual(expected);
    expect(accepted.actions.map((action: { initiatedBy: string }) => action.initiatedBy)).toEqual(expected.map(label => label === "Requested by Astra" ? "model" : "server"));
    await expect(actions).not.toContainText(/arguments|providerResponses|binding|evidenceIds|cited by/i);
    if (surface === "edit") {
      await expect(actions).toContainText("No model-initiated tool actions were recorded.");
      const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).draft, STORAGE_KEY);
      expect(stored.blocks[0].times).not.toEqual(accepted.proposal.preview.blocks[0].times);
      await expect(area(page, surface).getByRole("button", { name: "Apply & return to editor", exact: true })).toBeEnabled();
    }
    expect(f.state.posts).toEqual([endpoint(surface)]);
    expect(f.state.requests).toEqual(traffic);
    expect(f.state.external).toEqual([]);
  });

  test(`whale ${surface}: failure stops motion and preserves the generic failure`, async ({ page }) => {
    const f = await fixture(page, surface);
    f.state.fail = true;
    await open(page, surface);
    await ask(page, surface).click();
    await expect(whale(page, surface)).toHaveAttribute("data-state", "pending");
    f.release();
    await expect(whale(page, surface)).toHaveAttribute("data-state", "failed");
    await expect(area(page, surface)).toContainText(surface === "pair" ? "The investigation could not be validated" : "result could not be accepted");
    expect(await animations(whale(page, surface))).toEqual(["none", "none", "none"]);
    await expect(area(page, surface).locator(".astra-actions")).toHaveCount(0);
    await expect(area(page, surface)).not.toContainText(/Answer ready|Proposal ready/);
  });

  for (const change of ["cancel", "question", "binding", "workspace"] as const) {
    test(`whale ${surface}: ${change} stops pending and rejects a response that arrives after abort`, async ({ page }) => {
      const f = await fixture(page, surface, { ignoreAbort: true });
      await open(page, surface);
      const lateResponse = page.waitForResponse(`**${endpoint(surface)}`);
      await ask(page, surface).click();
      const indicator = whale(page, surface);
      await expect(indicator).toHaveAttribute("data-state", "pending");
      if (change === "cancel") await area(page, surface).getByRole("button", { name: /Cancel/ }).click();
      else if (change === "question") await requestText(page, surface).fill("Changed question while waiting.");
      else if (change === "workspace") await workspaceView(page, surface === "lab" ? "Listen" : "Context Lab");
      else if (surface === "lab") await page.getByLabel("Duration assignment", { exact: true }).selectOption("1");
      else if (surface === "pair") await page.getByLabel("Select recording B", { exact: true }).selectOption("dswp-11");
      else {
        await composerView(page, "edit");
        await page.getByLabel("Phrase title", { exact: true }).fill("New binding while waiting");
      }
      await expect(indicator).not.toHaveAttribute("data-state", "pending");
      expect(await animations(indicator)).toEqual(["none", "none", "none"]);
      f.release();
      await expect.poll(() => f.state.delivered).toBe(1);
      await (await lateResponse).finished();
      // Let the delivered JSON and React render settle before a negative assertion.
      await page.evaluate(() => new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ));
      await expect(indicator).not.toHaveAttribute("data-state", "completed");
      await expect(area(page, surface).locator(".astra-actions")).toHaveCount(0);
      expect(f.state.posts).toEqual([endpoint(surface)]);
    });
  }
}

test("whale: a final answer with zero model tool calls only attributes actual server actions", async ({ page }) => {
  const f = await fixture(page, "pair", { zeroModel: true });
  await open(page, "pair");
  f.release();
  await ask(page, "pair").click();
  await expect(whale(page, "pair")).toHaveAttribute("data-state", "completed");
  const actions = area(page, "pair").locator(".astra-actions");
  await actions.locator("summary").click();
  await expect(actions).toContainText("No model-initiated tool actions were recorded.");
  await expect(actions).not.toContainText("Requested by Astra");
  expect(await actions.locator("li > span").allTextContents()).toEqual(Array(3).fill("Performed by CodaBridge"));
  expect(f.mock.calls).toHaveLength(1);
});

test("whale: hidden request panels pause decoration and returning does not restart inference", async ({ page }) => {
  const f = await fixture(page, "edit");
  await open(page, "edit");
  await ask(page, "edit").click();
  const indicator = whale(page, "edit");
  await indicator.scrollIntoViewIfNeeded();
  await expect(indicator).toHaveAttribute("data-motion", "true");
  await composerView(page, "edit");
  await expect(indicator).toHaveAttribute("data-motion", "false");
  await expect(indicator).toHaveAttribute("data-state", "pending");
  expect(await indicator.locator(".astra-whale-body").evaluate(element => getComputedStyle(element).animationPlayState)).toBe("paused");
  await composerView(page, "compare");
  await indicator.scrollIntoViewIfNeeded();
  await expect(indicator).toHaveAttribute("data-motion", "true");
  expect(f.state.posts).toHaveLength(1);
  f.release();
  await expect(indicator).toHaveAttribute("data-state", "completed");
});

test("whale: imported and restored analysis stays historical and cannot create a completion or proposal", async ({ page }) => {
  const f = await fixture(page, "edit");
  await open(page, "edit");
  const project = projectJson(createDraft("dswp-1"), [], {
    status: "completed", execution: "provider", actions: [{ name: "control_result", initiatedBy: "model" }],
    privateSentinel: "TEST ONLY private saved analysis", proposal: { operations: [] },
  });
  await page.getByLabel("Open Composer project", { exact: true }).setInputFiles({ name: "historical.json", mimeType: "application/json", buffer: Buffer.from(project) });
  await expect(whale(page, "edit")).toHaveAttribute("data-state", "ready");
  await expect(area(page, "edit").locator(".astra-actions")).toHaveCount(0);
  await composerView(page, "save");
  await expect(page.getByText("Imported / saved analysis · unverified historical content")).toBeVisible();
  await page.reload();
  await composerView(page, "compare");
  await expect(whale(page, "edit")).toHaveAttribute("data-state", "ready");
  await expect(area(page, "edit")).not.toContainText(/Answer ready|Proposal ready|TEST ONLY private saved analysis/);
  expect(f.state.posts).toEqual([]);
  expect(f.mock.calls).toHaveLength(0);
});

test("whale: result disclosures exclude private draft text, bindings and raw tool arguments", async ({ page }) => {
  const f = await fixture(page, "edit");
  await open(page, "edit");
  await composerView(page, "edit");
  await page.getByLabel("Phrase title", { exact: true }).fill("TEST ONLY PRIVATE CREATOR TITLE");
  await page.getByLabel("Meaning I assign", { exact: false }).fill("TEST ONLY PRIVATE CREATOR MEANING");
  await composerView(page, "compare");
  const response = page.waitForResponse("**/api/composer");
  f.release();
  await ask(page, "edit").click();
  const accepted = await (await response).json();
  await expect(whale(page, "edit")).toHaveAttribute("data-state", "completed");
  expect(accepted.proposal.preview.title).toBe("TEST ONLY PRIVATE CREATOR TITLE");
  expect(accepted.actions[0].arguments).toHaveProperty("blockId");
  const displayed = await page.getByTestId("composer-result").textContent();
  expect(displayed).not.toMatch(/TEST ONLY PRIVATE|"binding"|"arguments"|test-opaque|encrypted_content/);
  await ask(page, "edit").focus();
  for (const name of ["Play synthetic proposal", "Apply & return to editor", "Discard proposal"]) {
    await page.keyboard.press("Tab");
    await expect(area(page, "edit").getByRole("button", { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const actions = area(page, "edit").locator(".astra-actions");
  await expect(actions.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(actions).toHaveAttribute("open");
  expect(f.mock.calls).toHaveLength(1);
});

test("whale: ordinary editing, Atlas, Prediction and Exchange stay outside Astra status presentation", async ({ page }) => {
  const f = await fixture(page, "edit");
  await open(page, "edit");
  await composerView(page, "edit");
  await expect(page.locator(".astra-whale:visible")).toHaveCount(0);
  await workspaceView(page, "Context Lab");
  await page.getByRole("button", { name: "Timing / Style Atlas", exact: true }).click();
  await expect(page.locator(".astra-whale:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "Dialogue Transfer / Prediction", exact: true }).click();
  await expect(page.locator(".astra-whale:visible")).toHaveCount(0);
  await workspaceView(page, "Exchange");
  await expect(page.locator(".astra-whale:visible")).toHaveCount(0);
  expect(f.state.posts).toEqual([]);
  expect(f.mock.calls).toHaveLength(0);
});

test.describe("whale visual evidence", () => {
  test("dark UI, pending to completed, reduced motion and 320px enlarged text", async ({ page }, info) => {
    const f = await fixture(page, "composer");
    await open(page, "composer");
    const indicator = whale(page, "composer");
    await ask(page, "composer").click();
    await expect(indicator).toHaveAttribute("data-state", "pending");
    await indicator.scrollIntoViewIfNeeded();
    await expect(indicator).toHaveAttribute("data-motion", "true");
    await page.screenshot({ path: info.outputPath("pending.png") });
    await page.waitForTimeout(1400); // Silent TEST ONLY clip shows restrained pending motion.
    f.release();
    await expect(indicator).toHaveAttribute("data-state", "completed");
    await page.waitForTimeout(700);
    await page.getByTestId("composer-result").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("completed.png") });
    await area(page, "composer").locator(".astra-actions summary").click();
    await page.screenshot({ path: info.outputPath("actions.png") });
    await page.emulateMedia({ reducedMotion: "reduce" });
    // A second controlled response is unnecessary: the same owner can complete fast.
    await expect(indicator).toContainText("Answer ready");
    expect(await animations(indicator)).toEqual(["none", "none", "none"]);
    await indicator.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("reduced-completed.png") });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await indicator.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect(await artSize(indicator)).toEqual({ width: 72, height: 72 });
    await page.screenshot({ path: info.outputPath("320-enlarged.png") });
  });
});

test("whale: reduced motion keeps pending text and disables all animation", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const f = await fixture(page, "lab");
  await open(page, "lab");
  await ask(page, "lab").click();
  const indicator = whale(page, "lab");
  await expect(indicator).toHaveAttribute("data-state", "pending");
  await indicator.scrollIntoViewIfNeeded();
  expect(await animations(indicator)).toEqual(["none", "none", "none"]);
  await expect(indicator).toContainText("Astra request in progress…");
  await page.screenshot({ path: info.outputPath("reduced-pending.png") });
  f.release();
  await expect(indicator).toContainText("Answer ready");
  expect(await animations(indicator)).toEqual(["none", "none", "none"]);
});
