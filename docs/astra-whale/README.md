# Astra pixel whale reference

This directory contains the visual references for the bounded Astra activity indicator.

## Authoritative silhouette

- `astra-whale-approved-silhouette.svg` is the current source of truth for the whale body silhouette, raised tail, short lower fin, square-cell construction, teal palette, and muted blue square eye.
- The SVG is a text-safe square-cell derivative of the original image approved in the design conversation. It exists specifically to avoid repeated binary-PNG truncation in the GitHub handoff.
- Use the SVG for silhouette decisions. Recreate the runtime mascot as a small React/inline-SVG component; do not ship the documentation reference itself as the runtime asset.

## Superseded reference

- `astra-whale-reference.png` is an earlier recovery/infographic reference. It may still be useful for the broader five-state visual vocabulary, but it is **not authoritative for the whale silhouette**.
- The previously added `astra-whale-approved-original.png` was corrupt/truncated and has been removed. Do not restore or use it.

## Runtime constraints

- Preserve the simplified right-facing whale, deep sea-green/teal block palette, raised tail, short lower fin, and muted blue eye.
- Use one shared whale body and small state effects rather than five separate runtime whales.
- The pictured/effect motifs are design vocabulary, not permission to fabricate live execution stages.
- Current browser request owners await a final JSON response; pending UI must remain truthful unless a real progress contract is added separately.
- Prefer one small whale beside existing Astra request/status areas. The answer/proposal remains primary.
- Respect reduced motion and expose all state meaning in text.

Implementation should continue on the existing `codex/astra-whale-indicator` branch and Draft PR #25 against `main`.
