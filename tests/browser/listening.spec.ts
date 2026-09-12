import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { parseProject } from "../../src/composer/project.ts";

let server: Server, url: string;
test.beforeAll(async () => {
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/prepare-listening.ts"],
    { stdio: "ignore" },
  );
  const manifest = JSON.parse(
    await readFile(".tmp/listening-pack/manifest.json", "utf8"),
  ) as { entries: { file: string }[] };
  const files = new Set([
    "listen.html",
    "manifest.json",
    "composer-project.json",
    ...manifest.entries.map((e) => e.file),
  ]);
  server = createServer((request, response) => {
    const file = new URL(request.url!, "http://localhost").pathname.slice(1);
    if (!files.has(file)) {
      response.writeHead(404).end();
      return;
    }
    const contentType = file.endsWith(".html")
      ? "text/html"
      : file.endsWith(".wav")
        ? "audio/wav"
        : "application/json";
    void readFile(`.tmp/listening-pack/${file}`)
      .then((bytes) => {
        response.writeHead(200, {
          "content-type": contentType,
          "content-length": bytes.length,
        });
        response.end(bytes);
      })
      .catch(() => response.writeHead(404).end());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/listen.html`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("key-free listening pack delivers all six exact WAVs and a restorable project; playback is exclusive", async ({
  page,
}, info) => {
  const manifest = JSON.parse(
    await readFile(".tmp/listening-pack/manifest.json", "utf8"),
  ) as { entries: { file: string; sha256: string; durationSeconds: number }[] };
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto(url);
  await expect(page.locator("audio")).toHaveCount(6);
  expect(
    await page
      .locator("audio")
      .evaluateAll((elements) =>
        elements.every(
          (e) =>
            (e as HTMLAudioElement).paused && !(e as HTMLAudioElement).autoplay,
        ),
      ),
  ).toBe(true);
  const delivered = [];
  for (const [i, entry] of manifest.entries.entries()) {
    const pending = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download labeled WAV", exact: true })
      .nth(i)
      .click();
    const bytes = await readFile((await (await pending).path())!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    const decoded = await page.evaluate(async (encoded) => {
      const context = new AudioContext();
      try {
        const buffer = await context.decodeAudioData(
          Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)).buffer,
        );
        let peak = 0;
        for (const sample of buffer.getChannelData(0))
          peak = Math.max(peak, Math.abs(sample));
        return {
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
          decodedRate: buffer.sampleRate,
          peak,
        };
      } finally {
        await context.close();
      }
    }, bytes.toString("base64"));
    expect(decoded.duration).toBeCloseTo(entry.durationSeconds, 4);
    expect(decoded.channels).toBe(1);
    if (i > 0) {
      expect(decoded.peak).toBeGreaterThan(0);
      expect(decoded.peak).toBeLessThan(0.16);
    }
    delivered.push({
      file: entry.file,
      deliveredHashMatches: true,
      ...decoded,
    });
  }
  // Existing native controls are exercised through their actual media elements.
  await page
    .locator("audio")
    .nth(4)
    .evaluate((audio) => (audio as HTMLAudioElement).play());
  await page
    .locator("audio")
    .nth(5)
    .evaluate((audio) => (audio as HTMLAudioElement).play());
  expect(
    await page
      .locator("audio")
      .nth(4)
      .evaluate((audio) => (audio as HTMLAudioElement).paused),
  ).toBe(true);
  await page.getByRole("button", { name: "Stop all playback" }).click();
  expect(
    await page
      .locator("audio")
      .evaluateAll((elements) =>
        elements.every((e) => (e as HTMLAudioElement).paused),
      ),
  ).toBe(true);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Re-openable Composer demonstration" })
    .click();
  const project = parseProject(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(project.draft!.blocks).toHaveLength(2);
  expect(project.draft!.blocks[1].times[1]).toBe(0.3);
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir("test-results/listening", { recursive: true });
  await page.screenshot({
    path: `test-results/listening/${info.project.name}.png`,
    fullPage: true,
  });
  await writeFile(
    `test-results/listening/${info.project.name}.json`,
    JSON.stringify(
      {
        delivery: "browser download and exact hash",
        delivered,
        projectRestorationValidated: true,
        noAutoplay: true,
        playbackOwnershipAndStop: true,
        modelCalls: 0,
        humanListening: "not performed",
        physicalDevice: "not tested",
      },
      null,
      2,
    ),
  );
});
