import { object, readBoundedJson } from "./validation.ts";

// Private development evidence only. This is deliberately a finite vocabulary,
// not an exhaustive provider taxonomy or a diagnosis of credentials/access.
const ERROR_TYPES = [
  "invalid_request_error",
  "authentication_error",
  "permission_error",
  "not_found_error",
  "rate_limit_error",
  "insufficient_quota",
  "server_error",
  "service_unavailable_error",
] as const;
const ERROR_CODES = [
  "invalid_api_key",
  "invalid_value",
  "unsupported_parameter",
  "missing_required_parameter",
  "model_not_found",
  "permission_denied",
  "rate_limit_exceeded",
  "insufficient_quota",
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
  "slow_down",
  "server_error",
  "server_is_overloaded",
] as const;
export const ERROR_ENVELOPE_BYTES = 4096;

export type PrivateProviderDiagnostic = Readonly<
  | {
      kind: "PROVIDER_TRANSPORT_FAILURE";
      httpResponseObtained: false;
    }
  | {
      kind: "PROVIDER_HTTP_FAILURE";
      httpResponseObtained: true;
      upstreamStatus: number;
      errorEnvelopeParseable: boolean;
      errorType: (typeof ERROR_TYPES)[number] | "unknown";
      errorCode: (typeof ERROR_CODES)[number] | "unknown";
    }
  | {
      kind: "PROVIDER_HTTP_RESPONSE";
      httpResponseObtained: true;
      upstreamStatus: number;
    }
>;
export type PrivateProviderObserver = (
  diagnostic: PrivateProviderDiagnostic,
) => void;

// Never pass an Error, response, headers or payload across this boundary. A
// collector failure must not change the investigation or cause another request.
export function observeProvider(
  observer: PrivateProviderObserver | undefined,
  diagnostic: PrivateProviderDiagnostic,
) {
  if (!observer) return;
  try {
    void Promise.resolve(observer(Object.freeze(diagnostic))).catch(() => {});
  } catch {
    // No logging: observer errors may contain private strings.
  }
}

function classification<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | "unknown" {
  return allowed.find((entry) => entry === value) ?? "unknown";
}

export async function httpFailureDiagnostic(
  response: Response,
  signal: AbortSignal,
): Promise<PrivateProviderDiagnostic> {
  const diagnostic = {
    kind: "PROVIDER_HTTP_FAILURE" as const,
    httpResponseObtained: true as const,
    upstreamStatus: response.status,
    errorEnvelopeParseable: false,
    errorType: "unknown" as (typeof ERROR_TYPES)[number] | "unknown",
    errorCode: "unknown" as (typeof ERROR_CODES)[number] | "unknown",
  };
  try {
    const envelope = object(
      await readBoundedJson(response, ERROR_ENVELOPE_BYTES, signal),
    );
    const error = object(envelope.error);
    diagnostic.errorEnvelopeParseable = true;
    diagnostic.errorType = classification(error.type, ERROR_TYPES);
    diagnostic.errorCode = classification(error.code, ERROR_CODES);
  } catch {
    // Non-JSON, invalid envelope, size/encoding/read failures and deadline:
    // the HTTP status is still known; retain no body or exception detail.
  } finally {
    // Also covers readBoundedJson's rejection before acquiring a reader.
    void response.body?.cancel().catch(() => {});
  }
  return diagnostic;
}
