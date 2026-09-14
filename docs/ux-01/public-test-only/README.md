# PUBLIC TEST ONLY

Every message, project and opening key here is invented, public test material. Never reuse these keys for private content. Baseline project/plain files are exact recovered browser downloads; filenames were disambiguated for this evidence bundle.

`final/` contains actual final-build A1/B1/A2 ciphertext downloads, separate explicitly confirmed plaintext exports, and the deliberately public `PUBLIC-TEST-ONLY-keys.json` manifest. Evidence filenames A1/B1/A2 are labels; the actual download name remains derivable from each file's public IV and was checked against the UI. File/key transfer in the walkthrough used separate automation bookkeeping, not a messenger or human Downloads journey.

From the repository root:

```sh
env -u OPENAI_API_KEY npm run sealed:verify -- docs/ux-01/public-test-only/final/PUBLIC-TEST-ONLY-keys.json
env -u OPENAI_API_KEY python3 scripts/verify-exchange.py docs/ux-01/public-test-only/baseline/plain-A1.coda.json docs/ux-01/public-test-only/baseline/plain-B1.coda.json
env -u OPENAI_API_KEY python3 scripts/verify-exchange.py docs/ux-01/public-test-only/baseline/plain-A1.coda.json docs/ux-01/public-test-only/final/plain-B1.coda.json
```

The two B1 files are alternative replies to the same A1; they must not be supplied as one sequential chain. The unchanged independent verifier authenticates/decrypts ciphertext with Node crypto, compares exact expected plaintext bytes, then checks canonical/source/hash/parent/timing consistency with Python. This is API/serialization evidence, not cryptographic certification.
