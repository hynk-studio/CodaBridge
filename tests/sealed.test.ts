import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCipheriv, createDecipheriv } from "node:crypto";
import { parseEnvelope, boundedJson, appendTurn, changeArrangement } from "../src/exchange/format.ts";
import { authenticatedHeader, base64url, cryptoAvailable, decode64, decryptEnvelope, encryptEnvelope, openingKey, parseSealed, readExchangeFile, sealedArtifact, SEALED_LIMITS } from "../src/exchange/sealed.ts";
import { SessionOwner } from "../src/exchange/session.ts";
import { decryptArtifact, encryptPublicFixture } from "../scripts/verify-sealed.mjs";

const plain = readFileSync("tests/fixtures/exchange-canonical.json", "utf8");
const first = () => parseEnvelope(plain);
const fixtureBytes = readFileSync("tests/fixtures/sealed/independent.coda.sealed.json");
const fixtureCode = JSON.parse(readFileSync("tests/fixtures/sealed/PUBLIC-TEST-ONLY-keys.json", "utf8")).entries[0].openingCode;
const fixture = () => sealedArtifact(parseSealed(fixtureBytes.toString()));
const broken = (bytes: Uint8Array, index: number) => { const b = new Uint8Array(bytes); b[index] ^= 1; return b; };

test("PUBLIC TEST ONLY pinned NIST AES-256-GCM vector matches Web Crypto and Node native APIs", async () => {
  const { vector: v, parameters: p } = JSON.parse(readFileSync("tests/fixtures/sealed/nist-gcm-256.json", "utf8"));
  assert.deepEqual(p, { Keylen: 256, IVlen: 96, PTlen: 128, AADlen: 128, Taglen: 128 });
  const key = Buffer.from(v.Key, "hex"), iv = Buffer.from(v.IV, "hex"), aad = Buffer.from(v.AAD, "hex"), message = Buffer.from(v.PT, "hex");
  const expected = Buffer.from(v.CT + v.Tag, "hex");
  const native = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
  const options = { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 };
  assert.equal(Buffer.from(await crypto.subtle.encrypt(options, native, message)).equals(expected), true);
  assert.equal(Buffer.from(await crypto.subtle.decrypt(options, native, expected)).equals(message), true);
  const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(aad);
  assert.equal(Buffer.concat([cipher.update(message), cipher.final(), cipher.getAuthTag()]).equals(expected), true);
  const decipher = createDecipheriv("aes-256-gcm", key, iv); decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(v.Tag, "hex"));
  assert.equal(Buffer.concat([decipher.update(Buffer.from(v.CT, "hex")), decipher.final()]).equals(message), true);
});

test("production seal uses fresh independent 32/12-byte RNG calls, nonextractable minimum usages, exact inner bytes", async t => {
  const rng = crypto.getRandomValues.bind(crypto), importer = crypto.subtle.importKey.bind(crypto.subtle);
  const lengths: number[] = [], usages: string[][] = [], retained: Uint8Array[] = [];
  t.mock.method(crypto, "getRandomValues", (buffer: Uint8Array<ArrayBuffer>) => { lengths.push(buffer.length); retained.push(buffer); return rng(buffer); });
  t.mock.method(crypto.subtle, "importKey", (...args: any[]) => { assert.equal(args[3], false); usages.push(args[4]); return (importer as any)(...args); });
  const e = await first(), a = await encryptEnvelope(e), b = await encryptEnvelope(e);
  assert.deepEqual(lengths, [32, 12, 32, 12]); assert.deepEqual(usages, [["encrypt"], ["encrypt"]]);
  assert.ok(retained.every(b => b.every(v => v === 0)), "mutable temporary RNG buffers wiped");
  assert.equal(a.code === b.code, false); assert.notEqual(a.artifact.wrapper.iv, b.artifact.wrapper.iv);
  assert.equal(await a.artifact.file.text(), await a.artifact.file.text());
  assert.equal(decryptArtifact(Buffer.from(await a.artifact.file.arrayBuffer()), a.code).toString(), boundedJson(e));
  assert.deepEqual(await decryptEnvelope(a.artifact, a.code), e);
  await assert.rejects(decryptEnvelope(b.artifact, a.code), /wrong key or damaged/);
  assert.deepEqual(Object.keys(a.artifact.wrapper), ["format", "version", "algorithm", "tagLength", "iv", "ciphertext"]);
  assert.match(a.artifact.file.name, /^codabridge-sealed-[A-Za-z0-9_-]{16}\.coda\.sealed\.json$/);
  for (const item of [e.digest, e.exchangeId, e.turns[0].message, e.turns[0].alias, e.turns[0].phrase.blocks[0].source.recordingId, a.code]) assert.equal((await a.artifact.file.text()).includes(item), false);
});

test("reverse interoperability opens independently encrypted fixed fixture without changing historical inner flags/bytes", async () => {
  const e = await decryptEnvelope(fixture(), fixtureCode);
  assert.equal(boundedJson(e), plain); assert.equal(e.protection, "none"); assert.match(e.interpretation, /plaintext, not encrypted/);
  assert.equal(new TextDecoder().decode(authenticatedHeader(fixture().wrapper)), '{"format":"codabridge-sealed","version":1,"algorithm":"AES-256-GCM","tagLength":128,"iv":"KSkpKSkpKSkpKSkp"}');
});

test("decryption drops mutable key/plaintext buffers after success and authenticated-invalid-inner failure", async t => {
  const importer = crypto.subtle.importKey.bind(crypto.subtle), decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
  const keys: Uint8Array[] = [], outputs: Uint8Array[] = [];
  t.mock.method(crypto.subtle, "importKey", async (...args: any[]) => {
    assert.equal(args[3], false); assert.deepEqual(args[4], ["decrypt"]); keys.push(args[1]); return (importer as any)(...args);
  });
  t.mock.method(crypto.subtle, "decrypt", async (...args: any[]) => { const result = await (decrypt as any)(...args); outputs.push(new Uint8Array(result)); return result; });
  await decryptEnvelope(fixture(), fixtureCode);
  const invalid = sealedArtifact(parseSealed(encryptPublicFixture(Buffer.from("{}"), Buffer.alloc(32, 23), Buffer.alloc(12, 41)).toString()));
  await assert.rejects(decryptEnvelope(invalid, fixtureCode), /wrong key or damaged/);
  assert.equal(keys.length, 2); assert.equal(outputs.length, 2);
  assert.ok([...keys, ...outputs].every(b => b.every(v => v === 0)));
});

test("opening-code syntax is bounded and canonical; surrounding ASCII whitespace and correctly sized zero key are allowed", () => {
  const zero = "cbsk1-" + base64url(new Uint8Array(32));
  assert.equal(openingKey(" \t\r\n" + zero + " \r\n").length, 32);
  for (const value of ["", "cbsk1-", zero.slice(0, -1), zero + "A", zero + "=", zero.toUpperCase(), "\u00a0" + zero, "\v" + zero, zero.slice(0, 10) + " " + zero.slice(10), zero.slice(0, -1) + "B", " ".repeat(81) + zero]) assert.throws(() => openingKey(value), /Invalid/);
  for (const size of [1, 2, 3, 12, 32, 10000]) { const value = crypto.getRandomValues(new Uint8Array(size)); assert.deepEqual(decode64(base64url(value), size, size), value); }
});

test("wrong key, changed IV, ciphertext/tag bits, truncation and append all fail authentication generically", async () => {
  const original = fixture(), joined = decode64(original.wrapper.ciphertext, 16, SEALED_LIMITS.ciphertext);
  await assert.rejects(decryptEnvelope(original, "cbsk1-" + base64url(new Uint8Array(32))), /wrong key or damaged/);
  for (const ciphertext of [base64url(broken(joined, 0)), base64url(broken(joined, joined.length - 1)), base64url(joined.slice(0, -1)), base64url(new Uint8Array([...joined, 0]))]) {
    await assert.rejects(decryptEnvelope(sealedArtifact({ ...original.wrapper, ciphertext }), fixtureCode), /wrong key or damaged/);
  }
  await assert.rejects(decryptEnvelope(sealedArtifact({ ...original.wrapper, iv: base64url(new Uint8Array(12)) }), fixtureCode), /wrong key or damaged/);
});

test("outer header is exact, shallow, bounded and duplicate-safe with canonical unpadded base64url", () => {
  const w = fixture().wrapper, valid = JSON.stringify(w);
  assert.deepEqual(parseSealed(JSON.stringify(Object.fromEntries(Object.entries(w).reverse()), null, 2)), w);
  const invalid = ["null", "[]", "{}", "{", valid.slice(0, -1) + ',"iv":"KSkpKSkpKSkpKSkp"}', valid.slice(0, -1) + ',"\\u0069v":"KSkpKSkpKSkpKSkp"}', "[".repeat(20), valid + " ".repeat(1048576)];
  for (const [key, value] of [["version", 2], ["algorithm", "AES-128-GCM"], ["tagLength", 96], ["format", "recursive"], ["iv", w.iv + "="], ["iv", "A".repeat(15)], ["ciphertext", ""], ["ciphertext", "A".repeat(21)], ["ciphertext", "A".repeat(699073)], ["iv", "☃"], ["iv", {}]]) invalid.push(JSON.stringify({ ...w, [key as string]: value }));
  invalid.push(JSON.stringify({ ...w, unknown: "x" }), valid.slice(0, -1) + ',"__proto__":{}}');
  for (const value of invalid) assert.throws(() => parseSealed(value));
});

test("input checks declared and actual bytes before crypto, fatal UTF-8, and never widens plaintext validation", async () => {
  let read = false;
  await assert.rejects(readExchangeFile({ size: 1048577, arrayBuffer() { read = true; } } as any), /1 MiB/); assert.equal(read, false);
  await assert.rejects(readExchangeFile({ size: 1, async arrayBuffer() { return new ArrayBuffer(1048577); } } as any), /1 MiB/);
  await assert.rejects(readExchangeFile(new File([new Uint8Array([0xff])], "bad")), /UTF-8/);
  await assert.rejects(readExchangeFile(new File([plain + " ".repeat(524288)], "plain")), /512 KiB/);
  const original = await readExchangeFile(new File([plain], "plain")); assert.equal(original.kind, "plain");
  const received = await readExchangeFile(new File([fixtureBytes], "sealed")); assert.equal(received.kind, "sealed");
  if (received.kind === "sealed") assert.equal(await received.artifact.file.text(), fixtureBytes.toString());
});

test("valid authentication around invalid inner UTF-8/JSON/source/checksum/parent/catalog is never accepted", async () => {
  const e = JSON.parse(plain), raw = Buffer.alloc(32, 23), iv = Buffer.alloc(12, 41);
  const cases = [Buffer.from([0xff]), Buffer.from("{}"), Buffer.from("null"), Buffer.from(plain.replace('"version":1', '"version":2')), Buffer.from(JSON.stringify({ ...e, digest: "0".repeat(64) })), Buffer.from(JSON.stringify({ ...e, catalogVersion: "bad" })), Buffer.from(plain.replace(e.turns[0].phrase.blocks[0].source.sourceRevision, "bad"))];
  const parent = structuredClone(e); parent.turns[0].parent = { turnId: "fake", digest: "0".repeat(64) }; cases.push(Buffer.from(JSON.stringify(parent)));
  for (const bytes of cases) {
    const artifact = sealedArtifact(parseSealed(encryptPublicFixture(bytes, raw, iv).toString()));
    await assert.rejects(decryptEnvelope(artifact, fixtureCode), /wrong key or damaged/);
  }
  assert.throws(() => parseSealed(encryptPublicFixture(Buffer.alloc(524289), raw, iv).toString()));
});

test("unsupported crypto, insecure context, RNG/encrypt failures never return a plaintext artifact", async t => {
  const e = await first();
  Object.defineProperty(globalThis, "isSecureContext", { value: false, configurable: true }); assert.equal(cryptoAvailable(), false); await assert.rejects(encryptEnvelope(e), /unavailable/); Reflect.deleteProperty(globalThis, "isSecureContext"); t.mock.restoreAll();
  t.mock.method(crypto, "getRandomValues", () => { throw new Error("TEST ONLY secret-like RNG detail"); });
  await assert.rejects(encryptEnvelope(e), e => e instanceof Error && !e.message.includes("secret-like") && e.message.includes("no plaintext")); t.mock.restoreAll();
  t.mock.method(crypto.subtle, "encrypt", () => Promise.reject(new Error("TEST ONLY injected failure"))); await assert.rejects(encryptEnvelope(e), /no plaintext/);
});

test("session lock clears all owned content/key/digest refs and rejects obsolete preparation; repeated bytes are stable", async () => {
  const owner = new SessionOwner<{ message: string }>(), e = await first(); owner.acceptPlain(e); owner.privateMode();
  const token = owner.generation.next(), value = await encryptEnvelope(e); owner.prepared(value, e.digest, token);
  assert.equal(owner.readyArtifact(), null); owner.acknowledge(true); const file = owner.readyArtifact()!.file;
  assert.equal(owner.readyArtifact()!.file, file);
  owner.install({ envelope: e, outgoing: { message: "TEST ONLY unsaved" } }); assert.equal(owner.readyArtifact(), null); assert.equal(owner.unsavedChanges(), true);
  owner.lock(); assert.equal(owner.current.mode, "locked"); assert.equal(owner.current.envelope, null); assert.equal(owner.current.outgoing, null); assert.equal(owner.current.prepared, null); assert.equal(owner.current.sealedDigest, null); assert.equal(value.code, ""); assert.equal(owner.current.encrypted!.file, file);
  const late = await encryptEnvelope(e); assert.equal(owner.prepared(late, e.digest, token), false); assert.equal(late.code, ""); assert.equal(owner.readyArtifact(), null);
  owner.acceptUnlocked(e, fixture()); assert.equal(owner.current.mode, "private"); assert.equal(owner.current.prepared, null);
  owner.install({ envelope: e, outgoing: { message: "TEST ONLY reply" } }); owner.acceptUnlocked(e, fixture()); assert.equal((owner.current.outgoing as { message: string } | null)?.message, "TEST ONLY reply");
  owner.reset(); assert.equal(owner.current.mode, "plain"); assert.equal(owner.current.encrypted, null);
});

test("new reply and arrangement seal freshly and preserve exact prefix; old seal is never current export", async () => {
  const e = await first(), firstSeal = await encryptEnvelope(e), parent = e.turns.at(-1)!;
  const { digest: _digest, ...content } = parent;
  const reply = await appendTurn(e, { ...content, id: "reply", role: "B", message: "PUBLIC TEST ONLY reply", parent: { turnId: parent.id, digest: parent.digest } });
  const owner = new SessionOwner(); owner.acceptUnlocked(e, firstSeal.artifact); owner.install({ envelope: reply, outgoing: null }); assert.equal(owner.readyArtifact(), null);
  const second = await encryptEnvelope(reply), arranged = await changeArrangement(reply, 0, .75), third = await encryptEnvelope(arranged);
  assert.equal(new Set([firstSeal.code, second.code, third.code]).size, 3); assert.equal(new Set([firstSeal.artifact.wrapper.iv, second.artifact.wrapper.iv, third.artifact.wrapper.iv]).size, 3);
  assert.deepEqual(arranged.turns, reply.turns); assert.deepEqual(reply.turns[0], e.turns[0]);
  await assert.rejects(decryptEnvelope(third.artifact, second.code), /wrong key or damaged/);
});
