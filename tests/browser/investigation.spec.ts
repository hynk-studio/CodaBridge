import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createWorker } from "../../server/worker.ts";
import type { ProviderTransport } from "../../server/provider.ts";
import type {
  PrivateProviderDiagnostic,
  PrivateProviderObserver,
} from "../../server/provider-diagnostics.ts";
import {
  errorResponse,
  PRIVATE_SENTINELS,
} from "../fixtures/provider-errors.ts";
import {
  finalOutput,
  happyTransport,
  identifierExplanation,
  INTERMEDIATE_TEXT,
  mixedTransport,
  scriptedTransport,
  TEST_ENV,
} from "../fixtures/provider.ts";

async function connectMockTransport(
  page: Page,
  transport: ProviderTransport,
  deadlineMs?: number,
  onPrivateProviderDiagnostic?: PrivateProviderObserver,
) {
  const worker = createWorker({
    transport,
    deadlineMs,
    onPrivateProviderDiagnostic,
  });
  // Only the provider transport is mocked. Requests still pass through production
  // request parsing, catalog resolution, tools, response validation and receipts.
  await page.route("**/api/**", async (route) => {
    const incoming = route.request();
    const response = await worker.fetch(
      new Request(incoming.url(), {
        method: incoming.method(),
        headers: incoming.headers(),
        ...(incoming.method() === "POST" ? { body: incoming.postData() } : {}),
      }),
      TEST_ENV,
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
}
async function exportPacket(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download evidence" }).click();
  const file = await (await download).path();
  return JSON.parse(await readFile(file!, "utf8"));
}

test("mixed provider commentary remains pending until the grounded final answer arrives", async ({
  page,
}) => {
  const mock = mixedTransport();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let awaitingFinal = false;
  await connectMockTransport(page, async (url, init) => {
    if (mock.calls.length === 1) {
      awaitingFinal = true;
      await gate;
    }
    return mock.transport(url, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Investigate selection" }).click();
  const panel = page.getByRole("region", { name: "Ask about this pair." });
  try {
    await expect.poll(() => awaitingFinal).toBe(true);
    await expect(panel.getByText("Pending", { exact: true })).toBeVisible();
    await expect(panel.getByText(INTERMEDIATE_TEXT)).toHaveCount(0);
    await expect(
      panel.getByText("Investigation completed for the current selection."),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    panel.getByText("Investigation completed for the current selection."),
  ).toBeVisible();
  await expect(
    panel.getByText(identifierExplanation().possibleInterpretations[0].text),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "Generated interpretation is unverified. References show traceability, not proof that a statement is correct.",
    ),
  ).toBeVisible();
  const packet = await exportPacket(page);
  expect(packet.investigation.execution).toBe("mock-transport-test");
  expect(packet.investigation.explanation).toEqual(identifierExplanation());
  expect(JSON.stringify(packet)).not.toContain(INTERMEDIATE_TEXT);
  expect(JSON.stringify(packet)).not.toContain(
    "test-opaque-reasoning-do-not-export",
  );
  expect(mock.calls).toHaveLength(2);
});

test("grounded UI completes via mock provider transport and exports actual tool evidence", async ({
  page,
}, testInfo) => {
  const mock = happyTransport();
  await connectMockTransport(page, mock.transport);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith("http://127.0.0.1:4173/")
    )
      external.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByText(/Listen to real sperm whale recordings/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reveal measurements", exact: true })
    .click();
  await expect(page.getByText("Measured · not AI-generated")).toBeVisible();
  await page.getByLabel("Start with a question").selectOption({
    label:
      "Find another recording closest to A under the normalized interval metric.",
  });
  await expect(page.getByLabel("Your question")).toHaveValue(
    "Find another recording closest to A under the normalized interval metric.",
  );
  await page.getByRole("button", { name: "Investigate selection" }).click();
  const panel = page.getByRole("region", { name: "Ask about this pair." });
  await expect(
    panel.getByText("Investigation completed for the current selection."),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "TEST ONLY · Mocked provider transport. This is not live Astra evidence.",
    ),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", {
      name: "Possible interpretations · generated",
    }),
  ).toBeVisible();
  await panel.getByText("retrieval:dswp-1:2", { exact: true }).last().click();
  await expect(
    panel.getByText(
      "Closest available alternatives under the timing metric; this is not a similarity threshold.",
    ),
  ).toBeVisible();
  await expect(
    panel.getByText(/dswp-7: Equal click counts are required/),
  ).toBeVisible();
  const packet = await exportPacket(page);
  expect(packet.investigation.execution).toBe("mock-transport-test");
  expect(
    packet.investigation.evidence.find(
      (item: { kind: string }) => item.kind === "retrieval",
    ).matches[0].sourceId,
  ).toBe("dswp-11");
  expect(packet.investigation.providerResponses).toHaveLength(2);
  expect(JSON.stringify(packet)).not.toContain(TEST_ENV.OPENAI_API_KEY);
  expect(JSON.stringify(packet)).not.toContain("test-opaque-reasoning");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: testInfo.outputPath(
      `${testInfo.project.name}-legacy-TEST-ONLY-investigation.png`,
    ),
  });
  expect(mock.calls).toHaveLength(2);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("selection change while pending obsoletes the result even if transport completes late", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mock = happyTransport();
  let started = false;
  let finished = false;
  await connectMockTransport(page, async (url, init) => {
    started = true;
    await gate;
    const response = await mock.transport(url, init);
    if (mock.calls.length === 2) finished = true;
    return response;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Investigate selection" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect.poll(() => started).toBe(true);
  await page
    .getByLabel("Select recording A", { exact: true })
    .selectOption("dswp-11");
  await expect(
    page.getByText(/Previous investigation is obsolete/),
  ).toBeVisible();
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(
    page.getByText("Investigation completed for the current selection."),
  ).toHaveCount(0);
  expect((await exportPacket(page)).investigation).toBeNull();
  await page
    .getByLabel("Select recording A", { exact: true })
    .selectOption("dswp-1");
  expect((await exportPacket(page)).investigation).toBeNull();
});

test("failure and timeout stay explicit and listening remains available", async ({
  page,
}) => {
  const mock = scriptedTransport([
    new Response("test provider failure", { status: 503 }),
  ]);
  await connectMockTransport(page, mock.transport);
  await page.goto("/");
  await page
    .getByLabel("Your question")
    .fill("Could uncertain markers affect the comparison?");
  await page.getByRole("button", { name: "Investigate selection" }).click();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/The investigation could not be validated/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play recording A" }),
  ).toBeEnabled();
  expect((await exportPacket(page)).investigation).toBeNull();
  await page.unroute("**/api/**");
  await connectMockTransport(page, async () => new Promise(() => {}), 25);
  await page.getByRole("button", { name: "Investigate selection" }).click();
  await expect(page.getByText(/The investigation timed out/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play recording B" }),
  ).toBeEnabled();
});

test("private HTTP diagnostic stays outside the public UI, response and downloaded evidence (TEST ONLY transport)", async ({
  page,
}) => {
  const diagnostics: PrivateProviderDiagnostic[] = [];
  const mock = scriptedTransport([
    errorResponse(404, "invalid_request_error", "model_not_found"),
  ]);
  await connectMockTransport(page, mock.transport, undefined, (item) => {
    diagnostics.push(item);
  });
  await page.goto("/");
  const pending = page.waitForResponse("**/api/investigate");
  await page.getByRole("button", { name: "Investigate selection" }).click();
  const response = await pending;
  const result = await response.json();
  expect(response.status()).toBe(502);
  expect(result.code).toBe("PROVIDER_FAILURE");
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/The investigation could not be validated/),
  ).toBeVisible();
  const packet = await exportPacket(page);
  expect(packet.investigation).toBeNull();
  expect(diagnostics).toEqual([
    {
      kind: "PROVIDER_HTTP_FAILURE",
      httpResponseObtained: true,
      upstreamStatus: 404,
      errorEnvelopeParseable: true,
      errorType: "invalid_request_error",
      errorCode: "model_not_found",
    },
  ]);
  const publicContent = JSON.stringify({
    result,
    packet,
    page: await page.locator("body").innerText(),
  });
  for (const value of [
    ...PRIVATE_SENTINELS,
    "PROVIDER_HTTP_FAILURE",
    "httpResponseObtained",
    "upstreamStatus",
    "errorEnvelopeParseable",
    "model_not_found",
    "invalid_request_error",
  ])
    expect(publicContent).not.toContain(value);
  for (const value of PRIVATE_SENTINELS)
    expect(JSON.stringify(diagnostics)).not.toContain(value);
  expect(mock.calls).toHaveLength(1);
});

test("no comparable alternative is visible and changing a completed selection clears export", async ({
  page,
}) => {
  // The provider's final text cites the server's truthful no-match tool result.
  const { functionOutput, explanation } = await import(
    "../fixtures/provider.ts"
  );
  const mock = scriptedTransport([
    functionOutput("find_alternatives", { referenceId: "dswp-7", limit: 2 }),
    finalOutput(explanation("retrieval:dswp-7:2")),
  ]);
  await connectMockTransport(page, mock.transport);
  await page.goto("/");
  await page
    .getByLabel("Select recording A", { exact: true })
    .selectOption("dswp-7");
  // The fixture limitation reference must resolve to a supplied selected recording.
  await page
    .getByLabel("Select recording B", { exact: true })
    .selectOption("dswp-1");
  await page.getByRole("button", { name: "Investigate selection" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByText("retrieval:dswp-7:2", { exact: true }).last().click();
  await expect(
    page.getByText("No comparable alternative in this catalog."),
  ).toBeVisible();
  expect(
    (await exportPacket(page)).investigation.evidence.find(
      (item: { kind: string }) => item.kind === "retrieval",
    ).status,
  ).toBe("no-match");
  await page
    .getByLabel("Select recording B", { exact: true })
    .selectOption("dswp-11");
  expect((await exportPacket(page)).investigation).toBeNull();
});
