import { disclosure } from "./navigation.ts";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("real audio decodes, plays exclusively, pauses, and comparison/export follow selection", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!/^(http:\/\/127\.0\.0\.1:4173|blob:|data:)/.test(request.url()))
      external.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await expect(page.getByLabel("Playback status B")).toHaveText(
    "Ready · source bytes checked",
  );
  await expect(page.locator(".wave-path")).toHaveCount(2);
  const media = page.locator("audio");
  const initial = await media.evaluateAll((elements) =>
    elements.map((element) => ({
      duration: (element as HTMLAudioElement).duration,
      paused: (element as HTMLAudioElement).paused,
      volume: (element as HTMLAudioElement).volume,
      rate: (element as HTMLAudioElement).playbackRate,
      ready: (element as HTMLAudioElement).readyState,
    })),
  );
  for (const item of initial) {
    expect(item.duration).toBeGreaterThan(2);
    expect(item.ready).toBeGreaterThanOrEqual(3);
    expect(item.paused).toBe(true);
    expect(item.volume).toBe(0.25);
    expect(item.rate).toBe(1);
  }
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Playback status A")).toHaveText("Playing");
  await expect
    .poll(() =>
      media
        .nth(0)
        .evaluate((element) => (element as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Play recording B", exact: true })
    .click();
  await expect(page.getByLabel("Playback status B")).toHaveText("Playing");
  expect(
    await media
      .nth(0)
      .evaluate((element) => (element as HTMLAudioElement).paused),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Pause recording B", exact: true })
    .click();
  await expect(page.getByLabel("Playback status B")).toHaveText("Paused");
  await page
    .getByLabel("Seek recording B", { exact: true })
    .press("ArrowRight");
  expect(
    await media
      .nth(1)
      .evaluate((element) => (element as HTMLAudioElement).currentTime),
  ).toBeGreaterThan(0);
  const originalMetric = await page.getByTestId("metric-value").textContent();
  await page
    .getByRole("button", { name: "Reveal measurements", exact: true })
    .click();
  expect(Number(originalMetric)).toBeGreaterThan(0);
  await page
    .getByRole("radio", { name: "Absolute", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Normalized", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("img", {
      name: "Normalized click timing for recordings A and B",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-value")).toHaveText(originalMetric!);
  expect(
    await media
      .nth(1)
      .evaluate((element) => (element as HTMLAudioElement).playbackRate),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Play recording A", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Select recording A", exact: true })
    .selectOption("dswp-2");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await expect(page.getByTestId("metric-value")).toHaveText("0.000000");
  expect(
    await media.evaluateAll((elements) =>
      elements.every((element) => (element as HTMLAudioElement).paused),
    ),
  ).toBe(true);
  await page.locator(".evidence-panel summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download recording-comparison JSON",
      exact: true,
    })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "codabridge-dswp-2-dswp-2-normalized.json",
  );
  const packet = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(packet.view).toBe("normalized");
  expect(
    packet.selection.map((item: { sourceId: string }) => item.sourceId),
  ).toEqual(["dswp-2", "dswp-2"]);
  expect(packet.comparison.value).toBe(0);
  expect(packet.selection[0].audio.sha256).toBe(
    "fc1847c125ebf0f5329ee0d421fa191d89a7ff40443372de944ef1df8e051417",
  );
  expect(packet.selection[0].annotation.status).toBe("machine-estimated");
  expect(packet.selection[0].originalTiming.clickTimesSeconds).toHaveLength(6);
  await page
    .getByRole("combobox", { name: "Select recording A", exact: true })
    .selectOption("dswp-1");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await page.getByRole("radio", { name: "Absolute", exact: true }).check();
  await expect(page.getByTestId("metric-value")).toHaveText(originalMetric!);
  await page
    .getByText("Source & annotation details", { exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "Pinned dataset card" }).first(),
  ).toBeVisible();
  await page
    .getByText("Source & annotation details", { exact: true })
    .first()
    .click();
  await disclosure(page, ".optional-investigation");
  await expect(
    page
      .getByRole("region", { name: "Ask about this pair." })
      .getByText(
        "Astra isn't enabled for this deployment. Listening, creation, and local analysis still work.",
        {
          exact: true,
        },
      ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath(
      `${testInfo.project.name}-legacy-unavailable.png`,
    ),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("missing audio is explicit, retry recovers, and the other recording remains usable", async ({
  page,
}) => {
  await page.route("**/audio/dswp-1.wav", (route) =>
    route.fulfill({
      status: 404,
      body: "Missing audio (test fault injection)",
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("HTTP 404");
  await expect(
    page.getByRole("button", { name: "Play recording A", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Playback status B")).toHaveText(
    "Ready · source bytes checked",
  );
  await page
    .getByRole("button", { name: "Play recording B", exact: true })
    .click();
  await expect(page.getByLabel("Playback status B")).toHaveText("Playing");
  await page.unroute("**/audio/dswp-1.wav");
  await page
    .getByRole("button", { name: "Retry audio A", exact: true })
    .click();
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("wrong audio bytes fail integrity checks instead of displaying a mismatched waveform", async ({
  page,
}) => {
  const wrong = await readFile("public/audio/dswp-1.wav");
  wrong[100] ^= 1;
  await page.route("**/audio/dswp-1.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: wrong }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("checksum");
  await expect(
    page.getByTestId("recording-A").locator(".wave-path"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play recording A", exact: true }),
  ).toBeDisabled();
});

test("an unsupported decoder produces a usable error state", async ({
  page,
}) => {
  // Browser fault injection only; the ordinary smoke path uses the real decoder.
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined });
  });
  await page.goto("/");
  await expect(
    page.getByTestId("recording-A").getByRole("alert"),
  ).toContainText("does not support audio decoding");
  await expect(
    page.getByRole("button", { name: "Play recording A", exact: true }),
  ).toBeDisabled();
  await page.locator(".evidence-panel summary").click();
  await expect(
    page.getByRole("button", {
      name: "Download recording-comparison JSON",
      exact: true,
    }),
  ).toBeEnabled();
});

test("320 px layout and enlarged text keep controls reachable without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByLabel("Playback status A")).toHaveText(
    "Ready · source bytes checked",
  );
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await expect(
    page.getByRole("button", { name: "Play recording A", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((element) => element.getBoundingClientRect().right > 320)
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        right: element.getBoundingClientRect().right,
      }))
      .slice(0, 20),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    JSON.stringify(overflow),
  ).toBeLessThanOrEqual(320);
});
