export const VERSION = "spectral-context-v1";
export const SOURCES = [
  { id: "ceti-spectral", repo: "Project-CETI/coda-vowel-phonology", revision: "be751b8761c87813754dba10ad7068a9e71367c0", path: "codasp.csv", bytes: 81709, sha256: "770af6f8057d6b88ccbf18b815015955795cbd7b20ae65733153d28cf117cb5b", gitBlob: "d3713078091116066a15f91c906abff9b9efef33" },
  { id: "ceti-environment", repo: "Project-CETI/Database-for-ship-noise", revision: "3c0fe9dc49c08c315995ae92e4de9045e07f2b82", path: "codasp_w_urn.csv", bytes: 100946, sha256: "7da160c79c1ce76984fddc12e499163bdbf60920612a7372ff4cb4943219f55a", gitBlob: "a134cc79555c96450f05692585d5c394afc74dc9" },
] as const;
export const sourceUrl = (s: typeof SOURCES[number]) => `https://raw.githubusercontent.com/${s.repo}/${s.revision}/${s.path}`;
export const DEFINITIONS_URL = "https://github.com/Project-CETI/coda-vowel-phonology/blob/be751b8761c87813754dba10ad7068a9e71367c0/README.9t6qu.md";
export const SHARED_FIELDS = ["codanum", "autovpkcodastr", "autovbycoda", "mismatchN", "mismatchpct", "meandist_pk1", "meandist_pk2", "meandiff_pk1", "meandiff_pk2", "focal", "whale", "codatype", "handv"];
export const EXTRA_FIELDS = ["Duration", "URN", "AIS_Data"];
export const FIELDS = Object.fromEntries([...SHARED_FIELDS, ...EXTRA_FIELDS].map(field => [field, {
  source: EXTRA_FIELDS.includes(field) ? SOURCES[1].id : SOURCES[0].id,
  definition: ["URN", "AIS_Data"].includes(field) ? "unresolved; raw code only" : DEFINITIONS_URL,
  unit: field === "Duration" ? "seconds" : field.startsWith("meand") ? "Hz" : field === "mismatchpct" ? "percent" : field === "mismatchN" ? "clicks" : "label",
  kind: ["handv", "whale", "codatype", "focal"].includes(field) ? "published annotation" : ["URN", "AIS_Data"].includes(field) ? "unresolved environmental annotation" : "published measurement or identifier",
}]));
export const REUSE = { status: "unresolved", distribution: "External rows are not bundled. Select your locally held pinned files for inspection.", evidence: ["Neither pinned GitHub source has a license file.", "The phonology README points to OSF 9t6qu; its license could not be retrieved on 2026-11-07.", "The shipping article is open access; a CSV-specific redistribution grant has not been established."], attribution: "Project CETI / Dominica Sperm Whale Project; Beguš et al. (2026), doi:10.1098/rspb.2025.2994; Diamant et al. (2026), doi:10.1016/j.ecoinf.2026.103881" };
