# Key-free preview and listening handoff

Prepared under [issue #7](https://github.com/hynk-studio/CodaBridge/issues/7), without credential access, inference, Site creation/save/deployment or audience changes.

## Reviewed foundation candidate

[Download Worker/client ZIP](release/foundation-afbaedeb/key-free-worker-client.zip) · [exact file manifest](release/foundation-afbaedeb/manifest.json).

Source commit **`afbaedeb2b10b61775a75a63be3067db3db764aa`**, tree **`8b576266b6abe9f5a797eb6f3700138c198b2bd0`**, exactly the accepted PR #5 source tree after ancestry-preserving integration. Built from an isolated extraction of this commit using `env -u OPENAI_API_KEY npm run build`; its fourteen built-server/native-workerd checks passed. It contains the reviewed Composer foundation, **not the newer unreviewed Lab**.

The ZIP contains only `dist/client`, `dist/server/index.js`, `dist/.openai/hosting.json`, a file manifest and the existing disabled `wrangler.local.json`. No environment file, key binding, node_modules, trial directory or owner's creation is included. Known test-secret/reasoning markers and key-shaped source strings were absent. This is artifact inspection, not a claim to have inspected any real credential. ZIP SHA-256: `acfc1587742b17b0e73f2cc02eb8d59f258f6355102578cb845949918e76228f`.

Extract under this repository's `.tmp/` to reuse its installed Wrangler, then run the manifest's loopback-only preview command (port 4174). No build or key is needed to run the prepared artifact. The current Lab branch can instead be built and previewed normally on port 4173:

```sh
env -u OPENAI_API_KEY npm run build
env -u OPENAI_API_KEY npm run preview
```

Current `.openai/hosting.json` is `{}`: no CodaBridge Site linkage is provisioned. Existing client/Worker shape is prepared locally; the platform has not saved or deployed either candidate. The [official Sites guide](https://learn.chatgpt.com/docs/sites) places create/save/deploy in ChatGPT web/desktop; saving a version and deploying it are distinct operations. A future handoff must verify account-specific availability, a CodaBridge-specific linkage, intended audience and the exact approved candidate. It must retain absent provider bindings and server-side `NOT_CONFIGURED` responses, then separately test hosted assets, audio, downloads and direct model endpoints. No public URL is claimed here.

## Five-minute listening pack

[Download listening ZIP](release/listening-pack.zip) · [full attribution, hashes and schedules](release/listening-manifest.json) · [automated delivery/decoding observations](release/listening-verification.json).

Unzip and open `listen.html`, or serve that extracted directory on loopback with `python3 -m http.server 4175 --bind 127.0.0.1`. Every Play is explicit; starting one stops the others. Stop all playback is available. The page has no API calls or external assets.

| File | What to hear |
| --- | --- |
| `01-original-field.wav` | Exact attributed DSWP `1.wav` bytes; not the research exchange |
| `02-synthetic-seed.wav` | Shared renderer at the seed's estimated relative timing |
| `03-uniformly-lengthened.wav` | Every gap multiplied by 1.25; proportions preserved |
| `04-single-gap-modified.wav` | Scaled block with first gap set to 0.300 s; other gaps preserved |
| `05-full-phrase.wav` | Seed block, spacing, modified independent copy |
| `06-annotated-exchange.wav` | 60-second research annotation reconstruction; not original audio |

`composer-project.json` is a newly prepared local demonstration with stable demo IDs, not an owner's private creation or a repeated live edit. Labels, source offset/revision, unknown whale meaning and credits survive export. Generate the pack with `env -u OPENAI_API_KEY node --experimental-strip-types scripts/prepare-listening.ts`. The same renderer schedules playback and export. Original bytes remain 44.1 kHz; browser decoding observations may be resampled to the AudioContext's 48 kHz rate.

Desktop and narrow-screen Chromium delivered all six WAV files with matching hashes, decoded them, enforced exclusive playback/Stop, and delivered a parseable/restorable Composer project. This does not establish human audibility, comfort, calibrated levels or physical-phone success.

- [ ] Owner distinguishes source field audio from synthetic timing.
- [ ] Uniform lengthening and a single-gap edit are perceptible and understandable.
- [ ] Playback is comfortable on the owner's ordinary hardware.
- [ ] Owner saves/reopens a phrase without coaching.
- [ ] Actual phone/browser download and restoration are observed.

Public Astra needs a separate server-enforced access/capacity/spending decision before any public credential binding. Flags are not authentication or a shared cap; per-action token bounds are not a settled bill. No account, storage, budgeting or abuse-control infrastructure is added in this PR.
