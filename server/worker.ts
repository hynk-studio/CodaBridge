import {
  recordings,
  selectionBinding,
  selectionKey,
} from "../src/domain/catalog.ts";
import {
  QUESTION_LIMIT,
  type CompletedInvestigation,
  type InvestigationRequest,
} from "../src/investigation.ts";
import type { Recording } from "../src/domain/types.ts";
import { createAnalysisTools } from "./tools.ts";
import type { PrivateProviderObserver } from "./provider-diagnostics.ts";
import { runComposer, composerFailure } from "./composer.ts";
import { runLab } from "./lab.ts";
import {
  LIMITS,
  requestResponse,
  validateExplanation,
  type ProviderTransport,
} from "./provider.ts";
import {
  BoundaryError,
  boundedText,
  exact,
  readBoundedJson,
} from "./validation.ts";

export interface ServerEnv {
  OPENAI_API_KEY?: string;
  CODABRIDGE_INVESTIGATION_ENABLED?: string;
  CODABRIDGE_ACCESS_REVIEWED?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
const unavailable = {
  status: "unavailable",
  code: "NOT_CONFIGURED",
  message:
    "Astra investigation is unavailable. Server access has not been enabled for this workspace.",
} as const;
const enabled = (env: ServerEnv) =>
  env.CODABRIDGE_INVESTIGATION_ENABLED === "true" &&
  env.CODABRIDGE_ACCESS_REVIEWED === "true" &&
  !!env.OPENAI_API_KEY?.trim();
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

function parseRequest(value: unknown): {
  request: InvestigationRequest;
  selected: [Recording, Recording];
} {
  const input = exact(value, ["sourceIds", "selectionKey", "question"]);
  if (!Array.isArray(input.sourceIds) || input.sourceIds.length !== 2)
    throw new BoundaryError("INVALID_SELECTION");
  const sourceIds = input.sourceIds.map((id) => boundedText(id, 64)) as [
    string,
    string,
  ];
  const selected = sourceIds.map((id) => recordings.find((r) => r.id === id));
  if (!selected[0] || !selected[1]) throw new BoundaryError("UNKNOWN_SOURCE");
  const selectedPair: [Recording, Recording] = [selected[0], selected[1]];
  const key = boundedText(input.selectionKey, 2048);
  if (key !== selectionKey(...selectedPair))
    throw new BoundaryError("STALE_SELECTION", 409);
  return {
    request: {
      sourceIds,
      selectionKey: key,
      question: boundedText(input.question, QUESTION_LIMIT),
    },
    selected: selectedPair,
  };
}

// Transport/deadline injection is a test seam. The optional private collector
// runs only in a trusted local trial wrapper; no HTTP/env flag enables it.
// Omitting transport retains this runtime's native Worker fetch.
export function createWorker(
  options: {
    transport?: ProviderTransport;
    deadlineMs?: number;
    onPrivateProviderDiagnostic?: PrivateProviderObserver;
  } = {},
) {
  const transport: ProviderTransport =
    options.transport ?? ((url, init) => fetch(url, init));
  return {
    async fetch(request: Request, env: ServerEnv = {}): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (!path.startsWith("/api/"))
        return env.ASSETS
          ? env.ASSETS.fetch(request)
          : new Response("Not found", { status: 404 });
      if (path === "/api/investigation/status") {
        if (request.method !== "GET")
          return json(
            {
              status: "failed",
              code: "METHOD_NOT_ALLOWED",
              message: "Use GET for availability.",
            },
            405,
          );
        return json(enabled(env) ? { status: "available" } : unavailable);
      }
      if (
        path !== "/api/investigate" &&
        path !== "/api/composer" &&
        path !== "/api/lab"
      )
        return json(
          { status: "failed", code: "NOT_FOUND", message: "Unknown endpoint." },
          404,
        );
      if (request.method !== "POST")
        return json(
          {
            status: "failed",
            code: "METHOD_NOT_ALLOWED",
            message: "Use POST for investigation.",
          },
          405,
        );
      const routeCap =
        path === "/api/lab" ? LIMITS.labDeadlineMs : LIMITS.deadlineMs;
      const controller = new AbortController();
      const stop = () => controller.abort();
      request.signal.addEventListener("abort", stop, { once: true });
      if (request.signal.aborted) controller.abort();
      const timer = setTimeout(
        stop,
        Math.min(options.deadlineMs ?? routeCap, routeCap),
      );
      try {
        const origin = request.headers.get("origin");
        if (
          (origin && origin !== new URL(request.url).origin) ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          throw new BoundaryError("CROSS_ORIGIN_REQUEST", 403);
        if (
          request.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/json"
        )
          throw new BoundaryError("CONTENT_TYPE", 415);
        if (path === "/api/lab") {
          if (!enabled(env)) return json(unavailable, 503);
          return json(
            await runLab(
              request,
              env,
              transport,
              controller.signal,
              !!options.transport,
              options.onPrivateProviderDiagnostic,
            ),
          );
        }
        if (path === "/api/composer") {
          if (!enabled(env)) return json(unavailable, 503);
          return json(
            await runComposer(
              request,
              env,
              transport,
              controller.signal,
              !!options.transport,
              options.onPrivateProviderDiagnostic,
            ),
          );
        }
        const { request: input, selected } = parseRequest(
          await readBoundedJson(
            request,
            LIMITS.requestBytes,
            controller.signal,
          ),
        );
        if (!enabled(env)) return json(unavailable, 503);
        const startedAt = new Date().toISOString();
        const tools = createAnalysisTools(selected);
        // Required evidence is always recomputed before interpreting a question.
        for (const source of selected)
          tools.dispatch(
            "recording_details",
            { sourceId: source.id },
            "server",
          );
        tools.dispatch("compare_selected", {}, "server");
        const history: unknown[] = [
          {
            role: "developer",
            content: JSON.stringify({
              binding: selectionBinding(...selected),
              catalogIds: recordings.map((r) => r.id),
              evidence: [...tools.evidence.values()],
            }),
          },
          { role: "user", content: input.question },
        ];
        const providerResponses: CompletedInvestigation["providerResponses"] =
          [];
        const callIds = new Set<string>();
        for (let round = 0; round < LIMITS.rounds; round++) {
          if (controller.signal.aborted)
            throw new BoundaryError("TIMEOUT", 504);
          const output = await requestResponse(
            history,
            env.OPENAI_API_KEY!,
            controller.signal,
            transport,
            options.onPrivateProviderDiagnostic,
          );
          providerResponses.push(output.receipt);
          if (output.toolCalls.length) {
            // No extra round is started once a limit is reached.
            if (round === LIMITS.rounds - 1)
              throw new BoundaryError("TOOL_ROUND_LIMIT", 502);
            history.push(...output.replay);
            for (const call of output.toolCalls) {
              if (callIds.has(call.callId) || callIds.size >= LIMITS.toolCalls)
                throw new BoundaryError("TOOL_CALL_LIMIT", 502);
              callIds.add(call.callId);
              const result = tools.dispatch(call.name, call.arguments);
              // Related source records produced by retrieval also become supplied evidence.
              history.push({
                type: "function_call_output",
                call_id: call.callId,
                output: JSON.stringify({
                  result,
                  evidence: [...tools.evidence.values()],
                }),
              });
            }
            continue;
          }
          const explanation = validateExplanation(output.final, tools.evidence);
          const result: CompletedInvestigation = {
            status: "completed",
            selectionKey: input.selectionKey,
            binding: selectionBinding(...selected),
            question: input.question,
            startedAt,
            completedAt: new Date().toISOString(),
            execution: options.transport ? "mock-transport-test" : "provider",
            providerResponses,
            actions: tools.actions,
            evidence: [...tools.evidence.values()],
            explanation,
          };
          const serialized = JSON.stringify(result);
          if (
            new TextEncoder().encode(serialized).byteLength > LIMITS.resultBytes
          )
            throw new BoundaryError("RESULT_LIMIT", 502);
          // Defense in depth: neither provider text nor metadata can echo the credential.
          if (serialized.includes(env.OPENAI_API_KEY!))
            throw new BoundaryError("INVALID_PROVIDER_OUTPUT", 502);
          return json(result);
        }
        throw new BoundaryError("TOOL_ROUND_LIMIT", 502);
      } catch (error) {
        const normalizedError = composerFailure(error);
        const failure =
          normalizedError instanceof BoundaryError
            ? normalizedError
            : new BoundaryError("INVESTIGATION_FAILED", 502);
        return json(
          {
            status: "failed",
            code:
              failure.code === "PROVIDER_TRANSPORT_FAILURE" ||
              failure.code === "PROVIDER_HTTP_FAILURE"
                ? "PROVIDER_FAILURE"
                : failure.code,
            message:
              failure.code === "TIMEOUT"
                ? "The investigation timed out. No explanation was accepted."
                : "The investigation could not be validated. Listening and comparison remain available.",
          },
          failure.status,
        );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", stop);
        controller.abort();
      }
    },
  };
}

export default createWorker();
