# Spectral / environmental integration v1

U1 of the [research upgrade plan](../../docs/RESEARCH_UPGRADE_PLAN_2026-11-07.md).

From the repository root:

    npm run spectral:fetch
    npm run spectral:check
    npm run spectral:verify
    node --experimental-strip-types --test tests/spectral-context.test.ts

The importer retrieves only the two immutable CSV URLs in `src/spectral/contract.ts`, validates byte size, SHA-256 and Git blob, and joins complete files by `codanum`. Cached sources and the complete row-level join report stay in ignored `data/raw/spectral-context-v1/`. The committed `verification.json` contains counts, provenance and missingness, not external rows. Failures produce an explicit blocked local report and admit no rows. The independent Python CSV reader verifies all 1,375 IDs, all 13 shared fields and code counts.

In Context Lab → **Spectrum / Environment**, open the two pinned files together to verify and explore them locally. Filtering shows its denominator, unknown producers, raw special codes, source lines and per-field provenance. The JSON download includes all joined rows and is produced only on explicit request. Import replacement and workspace changes obsolete asynchronous results. There is no waveform lookup or model request.

`Duration` is seconds and the peak distance/difference columns are Hz, as defined in the pinned phonology README. Manual `handv` and automated vowel labels remain separate. `URN` and `AIS_Data` semantics are unresolved: upstream R excludes URN −1 but provides no complete dictionary; 1* is not converted to true. Missing values remain null in interpretations and unchanged in raw values.

Reuse remains unresolved. Neither pinned GitHub tree contains a license; the README's OSF 9t6qu link returned 403 during this review. The shipping article is open access but does not establish a CSV-specific grant here. Consequently no external rows or audio are bundled. Attribution: Project CETI / Dominica Sperm Whale Project; Beguš et al. (2026), doi:10.1098/rspb.2025.2994; Diamant et al. (2026), doi:10.1016/j.ecoinf.2026.103881. This is a descriptive source join, without new independent samples, prediction fits or biological inference. Timing-archive candidate links remain in the historical audit only.

## Executed verification (2026-11-07)

Node 24.22.1 / Linux: full-file import and non-overwriting reproduction passed; independent Python verification passed; 4 focused tests, typecheck, lint, original data verification and production client/Worker build passed. Whole-suite result: 281/282 pass. The sole v0.2 exact replay failure also occurs on unchanged main: 27 log-duration targets differ by at most 2.22e-16 (no nonnumeric differences), consistent with cross-platform Math.log rounding. Frozen research files were not changed.

Browser acceptance remains blocked by this executor, not reported as a pass. Bundled Chromium 153 download was invalid; an official Chrome for Testing 157 download ran `--version`, but browser launch failed at `socket(): Operation not permitted`. Native Wrangler preview also failed at `uv_interface_addresses`. The desktop/phone import/export test is committed for an environment supporting browser sockets; no actual browser download, layout inspection, listening, deployment or model call is claimed.
