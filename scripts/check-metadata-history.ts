import { checkHistoricalPreservation } from "../analysis/metadata-linkage-v1/preservation-checks.ts";

console.log(JSON.stringify({ status: "Historical preservation verified from recorded Git objects; current application files are not checked", ...checkHistoricalPreservation() }, null, 2));
