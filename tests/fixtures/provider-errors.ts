// TEST ONLY: synthetic transport/error envelopes, never live-provider evidence.
import { TEST_ENV } from "./provider.ts";

export const PRIVATE_SENTINELS = [
  TEST_ENV.OPENAI_API_KEY,
  "TEST_ONLY_PRIVATE_MESSAGE",
  "org_TEST_ONLY_PRIVATE",
  "proj_TEST_ONLY_PRIVATE",
  "https://private.invalid/test-only",
  "/test-only/private/credential-location",
  "TEST_ONLY_STACK_TRACE",
  "TEST_ONLY_REQUEST_PAYLOAD",
  "TEST_ONLY_PRIVATE_HEADER",
] as const;

export function errorResponse(
  status: number,
  type: unknown = "invalid_request_error",
  code: unknown = "invalid_value",
) {
  return Response.json(
    {
      error: {
        type,
        code,
        message: PRIVATE_SENTINELS.join(" "),
        param: PRIVATE_SENTINELS.join(" "),
        organization: PRIVATE_SENTINELS[2],
        project: PRIVATE_SENTINELS[3],
      },
      request: PRIVATE_SENTINELS[7],
    },
    {
      status,
      headers: {
        authorization: `Bearer ${TEST_ENV.OPENAI_API_KEY}`,
        "x-test-private": PRIVATE_SENTINELS.join(" "),
      },
    },
  );
}

export const HTTP_ERROR_CASES = [
  [400, "invalid_request_error", "invalid_value"],
  [401, "invalid_request_error", "invalid_api_key"],
  [403, "permission_error", "permission_denied"],
  [404, "invalid_request_error", "model_not_found"],
  [429, "rate_limit_error", "rate_limit_exceeded"],
  [429, "insufficient_quota", "project_spend_limit_exceeded"],
  [500, "server_error", "server_error"],
  [503, "service_unavailable_error", "server_is_overloaded"],
] as const;
