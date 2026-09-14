# Pending Mac → Android check · 10–15 minutes

**One setup request:** connect your Android phone to this Mac by USB and approve USB debugging/trust for this computer when ready. No connected phone or existing ADB setup was found. Device consent remains yours; no debugging setting, certificate or browser security flag was changed. Do not paste opening codes into chat or this checklist.

The previews are **stopped**. In the isolated candidate worktree, these are the verified local start commands (Node 22.18+; dependencies are already present here):

```sh
cd /Users/hynk/code/CodaBridge-ux-01
env -u OPENAI_API_KEY npm run build
env -u OPENAI_API_KEY npm run preview
```

Use `http://127.0.0.1:4173` in a separate test browser profile on the Mac. If port 4173 is occupied, do not stop someone else's service; resolve that conflict before starting. Stop this preview with **Ctrl-C in its own terminal**. Browser tests manage their own preview when none is running. Build output is not a hosted site, and historical release ZIPs are not this candidate.

For phone access, on the Mac open `chrome://inspect/#devices`, enable discovery of USB devices, and use **Port forwarding** to map device port **4173** to **127.0.0.1:4173**. Enable the mapping, then open **http://localhost:4173** in Android Chrome. This follows Chrome's [USB forwarding instructions](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/) and [device consent/setup instructions](https://developer.chrome.com/docs/devtools/remote-debugging/). It keeps the app listener on Mac loopback. Remove only the mapping made for this check afterward.

Inspect the phone's actual origin before sealing, with this read-only console expression in its remote DevTools:

```js
({ origin: location.origin, secure: isSecureContext,
   random: typeof crypto?.getRandomValues === "function",
   cryptoReady: ["encrypt", "decrypt", "importKey", "digest"]
     .every(name => typeof crypto?.subtle?.[name] === "function") })
```

Record the returned values and device/browser versions, never an opening code. If the device is absent, trust is unapproved, forwarding fails or crypto is unavailable, record that exact blocker. Do not use a LAN address, tunnel or insecure-origin exception as a workaround.

App access, file transfer and key transfer are separate. USB forwarding serves the app; it does not deliver a downloaded coda file. Choose an owner-approved USB/local transfer for test files and a separately trusted route for the test key. No messaging account or recipient is selected automatically. Use invented **PUBLIC TEST ONLY** text throughout.

| Time | Goal and observation to record | Result |
| --- | --- | --- |
| 0–3 min | On Mac A, start from home, play an original at a low ordinary volume, make a personal variation, change a gap, undo/redo and keep it. Which sound is original/synthetic? Can you hear the chosen change? Is playback comfortable? Stop on discomfort; no calibrated loudness claim or wildlife playback. | Awaiting owner |
| 3–5 min | Send an ordinary transmission to Android B. Without a hint, identify the reopenable file among the downloads, find it again and open it. What history is included? Record backtracks or help needed. | Awaiting owner |
| 5–9 min | Create sealed A1, deliver the file and key separately, open on B, reply B1 and return it to A. What else does a recipient need? Does the reply need the same code or another? Record file/key matching difficulties without recording the codes. | Awaiting owner |
| 9–12 min | With an unfinished note, cancel a discard request, background/return, and open/cancel the real OS share chooser when available. Check text retention, explicit Reveal/Hide/Copy, lock/cancel/re-unlock and refresh/file reopening. Observe actual `document.hidden` during backgrounding if available; do not modify it. | Awaiting owner |
| 12–15 min | Open the returned file in a fresh profile. Can you distinguish masking, local lock, refresh loss and the retained file? Did Composer work remain? Does the rhythm feel personally authored? Record the person's words and any assistance. | Awaiting owner |

Device/browser/origin/crypto: **pending**. Actual OS picker/share cancellation, phone IME, clipboard and background lifecycle: **pending**. Human comfort/perceptibility/comprehension: **pending**. One owner using both devices is a two-device check, not two independent participants. Capture only consented app states with keys masked; keep traces/screencasts off if they could expose keys, notifications or other apps.
