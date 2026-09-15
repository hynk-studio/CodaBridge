const localWork = "Listening, creation, and local analysis still work.";
export const ASTRA_REQUEST_FAILED = "Astra couldn't complete this request. Your work is unchanged.";

// Only the existing allowlisted configuration response establishes this cause.
// Network/unknown failures must not imply that deployment access is disabled.
export function astraUnavailableCopy(value?: { status?: unknown; code?: unknown }) {
  return value?.status === "unavailable" && value.code === "NOT_CONFIGURED"
    ? `Astra isn't enabled for this deployment. ${localWork}`
    : `Astra is unavailable. ${localWork}`;
}
