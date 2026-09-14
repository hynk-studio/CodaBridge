import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { recordings } from "../src/domain/catalog.ts";
import { applyOperations, commitDraft, createDraft, seedBlock, travel } from "../src/composer/model.ts";
import { appendTurn, boundedJson, canonicalPayload, canonicalTurn, changeArrangement, decodeJson, Generation, parseEnvelope, preparedFile, readCodaFile, sha256 } from "../src/exchange/format.ts";
import { copyComposerTiming, editorDraft, EXCHANGE_LIMITS, humanText, parsePayload, parsePhrase, phraseFromBlocks, seedPhrase, sourceDescriptor, turnContent, type Envelope, type Phrase, type TurnContent } from "../src/exchange/model.ts";
import { exchangeSchedule, exchangeWav } from "../src/exchange/sound.ts";

const digest = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
function content(previous: Envelope | null = null, phrase = seedPhrase("dswp-1")): TurnContent {
  const n = previous?.turns.length ?? 0, parent = previous?.turns.at(-1);
  return { id: `turn-${n + 1}`, exchangeId: previous?.exchangeId ?? "exchange-test", role: n % 2 ? "B" : "A", alias: "TEST ONLY alias", label: "TEST ONLY style", createdAt: null,
    message: "TEST ONLY message 🌊 안녕 e\u0301", phrase, parent: parent ? { turnId: parent.id, digest: parent.digest } : null };
}
const first = () => appendTurn(null, content());
const clone = <T,>(v: T): T => structuredClone(v);
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("Exchange projection copies only chosen timing/current source, never private work or removed ancestry", () => {
  const draft = createDraft("dswp-1");
  draft.title = "TEST ONLY private title"; draft.intention = "TEST ONLY private intention";
  draft.id = "private-project-id"; draft.blocks[0].id = "private-block-id"; draft.blocks[0].meaning = "TEST ONLY private meaning";
  draft.blocks.push(seedBlock("dswp-2", "unselected-block"));
  draft.ancestry.push(seedBlock("dswp-2").seed, seedBlock("dswp-7").seed);
  const before = clone(draft), phrase = copyComposerTiming(draft, draft.blocks[0].id, "selected");
  assert.equal(phrase.blocks.length, 1); assert.deepEqual(phrase.blocks[0].times, draft.blocks[0].times);
  assert.equal(phrase.blocks[0].source.filename, "1.wav");
  const bytes = JSON.stringify(phrase);
  for (const excluded of ["private", "unselected", "dswp-2", "dswp-7", "title", "intention", "meaning", "ancestry", "revision"]) assert.ok(!bytes.includes(excluded), excluded);
  assert.equal(copyComposerTiming(draft, draft.blocks[0].id, "phrase").blocks.length, 2);
  assert.deepEqual(draft, before);
  const bad = clone(draft); bad.blocks[0].seed.sourceRevision = "unsupported";
  assert.throws(() => copyComposerTiming(bad, bad.blocks[0].id, "selected"), /pinned catalog/);
});

test("Outgoing editing reuses atomic Composer operations and undo/redo without mutating its source", () => {
  const original = createDraft("dswp-1"), copy = copyComposerTiming(original, original.blocks[0].id, "selected");
  const draft = editorDraft(copy), before = clone(original);
  const history = { present: draft, past: [], future: [] };
  const changed = commitDraft(history, applyOperations(draft, [{ op: "scale_duration", blockId: draft.blocks[0].id, factor: 1.25 }]));
  assert.deepEqual(travel(changed, "undo").present.blocks, draft.blocks);
  assert.deepEqual(travel(travel(changed, "undo"), "redo").present.blocks, changed.present.blocks);
  assert.throws(() => applyOperations(draft, [{ op: "set_gap", blockId: draft.blocks[0].id, gapIndex: 0, seconds: 0 }]));
  assert.deepEqual(original, before); assert.deepEqual(editorDraft(copy).blocks, draft.blocks);
});

test("A1/B1/A2 snapshots are immutable, independently sourced, parent-linked and stable across downloads", async () => {
  const a = await first(), b = await appendTurn(a, content(a, seedPhrase("dswp-2"))), c = await appendTurn(b, content(b, seedPhrase("dswp-7")));
  assert.deepEqual(c.turns.slice(0, 2), b.turns); assert.deepEqual(b.turns[0], a.turns[0]);
  assert.deepEqual(c.turns.map(t => t.role), ["A", "B", "A"]);
  assert.deepEqual(c.turns.map(t => t.phrase.blocks[0].source.recordingId), ["dswp-1", "dswp-2", "dswp-7"]);
  assert.equal(c.turns[2].parent!.digest, b.turns[1].digest);
  assert.throws(() => { c.turns[0].message = "mutation"; });
  assert.throws(() => { c.turns[0].phrase.blocks[0].times.push(4); });
  assert.equal(await preparedFile(c).text(), await preparedFile(c).text());
  assert.equal(preparedFile(c).name, "codabridge-exchange-test-3.coda.json");
  assert.deepEqual(await parseEnvelope(await preparedFile(c).text()), c);
});

test("Canonical encoding ignores object order/whitespace, retains Unicode and normalizes negative zero only", async () => {
  const original = content(); original.phrase.blocks[0].times[0] = -0;
  const a = await appendTurn(null, original);
  const reverse = (v: any): any => Array.isArray(v) ? v.map(reverse) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverse(x)])) : v;
  assert.deepEqual(await parseEnvelope(JSON.stringify(reverse(a), null, 4)), a);
  const encoded = canonicalTurn(original);
  assert.ok(encoded.includes("🌊 안녕 e\u0301")); assert.ok(!encoded.includes('"times":[-0'));
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(a.turns[0].digest, digest(encoded));
  assert.notEqual(await sha256(canonicalTurn({ ...original, message: "é" })), await sha256(canonicalTurn({ ...original, message: "e\u0301" })));
});

test("TEST ONLY fixed encoding fixture has independently recorded bytes and hashes", async () => {
  const json = readFileSync("tests/fixtures/exchange-canonical.json", "utf8");
  const expected = JSON.parse(readFileSync("tests/fixtures/exchange-canonical-hashes.json", "utf8"));
  assert.equal(digest(json), expected.fileSha256);
  const envelope = await parseEnvelope(json), { digest: recorded, ...payload } = envelope;
  assert.equal(digest(canonicalPayload(payload)), expected.payloadSha256);
  assert.equal(recorded, expected.payloadSha256);
  assert.equal(digest(canonicalTurn(turnContent(envelope.turns[0]))), expected.turnSha256);
  assert.equal(await preparedFile(envelope).text(), json);
});

test("Checksums bind text, ordered blocks, arrangement and exact source references", async () => {
  const a = await first(), b = await appendTurn(a, content(a));
  for (const mutate of [
    (v: Envelope) => { v.turns[0].message += "edited"; },
    (v: Envelope) => { v.turns[0].phrase.blocks[0].times[1] += .001; },
    (v: Envelope) => { v.arrangement.gaps[0] += .1; },
    (v: Envelope) => { v.digest = "0".repeat(64); },
  ]) { const changed = clone(b); mutate(changed); await assert.rejects(parseEnvelope(JSON.stringify(changed)), /checksum/); }
  for (const key of ["sourceRevision", "audioSha256", "annotationVersion", "originalOffsetSeconds", "filename", "attribution", "license"]) {
    const changed = clone(b); (changed.turns[0].phrase.blocks[0].source as any)[key] = "unsupported";
    await assert.rejects(parseEnvelope(JSON.stringify(changed)), /catalog/);
  }
  const broken = clone(a); broken.turns[0].digest = "0".repeat(64);
  await assert.rejects(appendTurn(broken, content(broken)), /checksum/);
  await assert.rejects(changeArrangement({ ...b, digest: "0".repeat(64) }, 0, .7), /checksum/);
});

test("Exact duplicate IDs, broken parents, cycles, reordering and role/exchange mismatches fail", async () => {
  const a = await first(), b = await appendTurn(a, content(a)), c = await appendTurn(b, content(b));
  for (const mutate of [
    (v: Envelope) => { v.turns[1].id = v.turns[0].id; },
    (v: Envelope) => { v.turns[0].parent = { turnId: v.turns[2].id, digest: v.turns[2].digest }; },
    (v: Envelope) => { v.turns[1].parent!.turnId = "missing"; },
    (v: Envelope) => { v.turns[1].parent!.digest = "0".repeat(64); },
    (v: Envelope) => { v.turns.reverse(); },
    (v: Envelope) => { v.turns[1].role = "A"; },
    (v: Envelope) => { v.turns[1].exchangeId = "different"; },
    (v: Envelope) => { v.turns.splice(1, 1); },
  ]) { const changed = clone(c); mutate(changed); await assert.rejects(parseEnvelope(JSON.stringify(changed))); }
});

test("Consistently rewritten labels/tied timestamps are not authentication or ordering authority", async () => {
  const c = content(); c.createdAt = "2026-01-01T00:00:00.000Z"; c.alias = "TEST ONLY someone else";
  const a = await appendTurn(null, c), b = await appendTurn(a, { ...content(a), createdAt: c.createdAt, alias: c.alias });
  assert.deepEqual((await parseEnvelope(JSON.stringify(b))).turns.map(t => t.id), ["turn-1", "turn-2"]);
  assert.equal(b.interpretation.includes("authorship unverified"), true);
  await assert.rejects(appendTurn(null, { ...c, createdAt: "2026-02-30T00:00:00.000Z" }));
  const distinct = await appendTurn(a, { ...content(a), id: "Turn-1" });
  assert.equal(distinct.turns.length, 2); // IDs are case sensitive, never folded/fuzzed.
});

test("Arrangement edits change envelope identity without rewriting immutable turns", async () => {
  const a = await first(), b = await appendTurn(a, content(a)), altered = await changeArrangement(b, 0, .75);
  assert.notEqual(altered.digest, b.digest); assert.deepEqual(altered.turns, b.turns);
  assert.deepEqual(altered.arrangement.gaps, [.75]); assert.deepEqual(b.arrangement.gaps, [.5]);
  for (const value of [NaN, Infinity, -Infinity, 0, .049, 5.001]) await assert.rejects(changeArrangement(b, 0, value));
  await assert.rejects(changeArrangement(b, 1, .5));
});

test("Malformed/version/protection/unknown/deep/prototype/duplicate-key/nonfinite input fails boundedly", async () => {
  const a = await first();
  for (const changed of [{ ...a, version: 2 }, { ...a, protection: "encrypted" }, { ...a, format: "codabridge-project" }, { ...a, provider: {} }, { ...a, catalogVersion: "unknown" }, { ...a, rendererVersion: "unknown" }]) await assert.rejects(parseEnvelope(JSON.stringify(changed)));
  for (const raw of ["{", '{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"__proto__":{}}', '{"constructor":{}}', "[".repeat(10000) + "0" + "]".repeat(10000), '{"x":1e999}', "null", "[]"]) await assert.rejects(parseEnvelope(raw));
  assert.deepEqual(decodeJson('{"text":"[[[ braces } and \\\"quotes\\\""}'), { text: '[[[ braces } and "quotes"' });
  const circular: any = {}; circular.self = circular; assert.throws(() => parsePayload(circular), /complex/);
});

test("Input byte cap applies before reading and to actual UTF-8 bytes; invalid UTF-8 fails", async () => {
  let read = false;
  await assert.rejects(readCodaFile({ size: EXCHANGE_LIMITS.bytes + 1, arrayBuffer: () => { read = true; return Promise.resolve(new ArrayBuffer(0)); } } as File), /512 KiB/);
  assert.equal(read, false);
  await assert.rejects(readCodaFile({ size: 1, arrayBuffer: async () => new ArrayBuffer(EXCHANGE_LIMITS.bytes + 1) } as File), /512 KiB/);
  await assert.rejects(readCodaFile(new File([new Uint8Array([0xc3, 0x28])], "invalid.coda.json")), /UTF-8/);
  const a = await first(), json = boundedJson(a);
  const padding = " ".repeat(EXCHANGE_LIMITS.bytes - Buffer.byteLength(json));
  assert.deepEqual(await parseEnvelope(padding + json), a);
  await assert.rejects(parseEnvelope(padding + "🌊" + json), /512 KiB/);
  assert.throws(() => boundedJson("x".repeat(EXCHANGE_LIMITS.bytes)), /512 KiB/);
});

test("Text uses strict UTF-16 bounds, preserves whitespace and rejects controls/unpaired Unicode", () => {
  assert.equal(humanText("🌊".repeat(24), 48).length, 48);
  assert.equal(humanText("line\nline\tend\r", 80), "line\nline\tend\r");
  for (const [value, max] of [["🌊".repeat(25), 48], ["x".repeat(81), 80], ["x".repeat(2001), 2000], ["\u0000", 48], ["\ud800", 48], ["\udfff", 48]] as const) assert.throws(() => humanText(value, max));
});

test("Phrase dimensions/gaps/source and <=8 turn / <=120 second arrangement limits stay enforced", async () => {
  const p = seedPhrase("dswp-1");
  for (const mutate of [(v: Phrase) => { v.blocks = []; }, (v: Phrase) => { v.blocks[0].times = [0]; }, (v: Phrase) => { v.blocks[0].times[1] = 0; }, (v: Phrase) => { v.blocks[0].times[1] = NaN; }, (v: Phrase) => { v.blocks = Array(5).fill(v.blocks[0]); }]) { const v = clone(p); mutate(v); assert.throws(() => parsePhrase(v)); }
  let e = await first(); for (let i = 1; i < 8; i++) e = await appendTurn(e, content(e));
  await assert.rejects(appendTurn(e, content(e)), /1–8/); assert.equal(e.turns.length, 8);
  const long = clone(p); long.blocks[0].times = [0, 5, 10, 15, 20, 25, 29];
  let bounded = await appendTurn(null, content(null, long));
  for (let i = 1; i < 4; i++) bounded = await appendTurn(bounded, content(bounded, long));
  for (const [i, gap] of [1, 1, 2].entries()) bounded = await changeArrangement(bounded, i, gap);
  assert.equal(exchangeSchedule(bounded).span, 120);
  await assert.rejects(changeArrangement(bounded, 2, 2.00001));
  await assert.rejects(appendTurn(bounded, content(bounded)));
});

test("Independent hand-computable schedule/WAV checks use one lead/tail and no message metadata", async () => {
  const p = seedPhrase("dswp-1"); p.blocks[0].times = [0, .1, .3]; p.blocks[0].spacingAfter = .2;
  p.blocks.push({ ...clone(p.blocks[0]), id: "second-block", times: [0, .2, .4] });
  const q = seedPhrase("dswp-2"); q.blocks[0].times = [0, .2, .5];
  const a = await appendTurn(null, content(null, p)), b = await appendTurn(a, content(a, q));
  const s = exchangeSchedule(b), expected = [.05, .15, .35, .55, .75, .95, 1.45, 1.65, 1.95];
  assert.equal(s.events.length, expected.length); s.events.forEach((e, i) => near(e.seconds, expected[i])); near(s.span, 1.9); near(s.duration, 1.99);
  const wav = Buffer.from(exchangeWav(b)); assert.equal(wav.toString("ascii", 0, 4), "RIFF"); assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt32LE(4), wav.length - 8); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), 48000); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40) / 2, Math.ceil(s.duration * 48000));
  const frames = wav.readUInt32LE(40) / 2;
  for (const t of expected) {
    const start = Math.round(t * 48000), i = 31, v = wav.readInt16LE(44 + (start + i) * 2);
    const value = .16 * Math.sin(Math.PI * i / 576) ** 2 * Math.exp(-(i / 48000) * 240) * Math.sin(2 * Math.PI * 1400 * i / 48000);
    assert.ok(Math.abs(v - Math.round(value * 32767)) <= 1); assert.notEqual(v, 0);
  }
  for (let i = 0; i < frames; i++) assert.ok(Math.abs(wav.readInt16LE(44 + 2 * i)) <= Math.ceil(.16 * 32767));
  const metadata = wav.subarray(44 + frames * 2).toString();
  for (const t of b.turns) for (const privateText of [t.message, t.alias, t.label]) assert.ok(!metadata.includes(privateText));
  assert.ok(metadata.includes("CC BY 4.0")); assert.ok(metadata.includes("audioSha256"));
});

test("All four pinned source credits fit the bounded WAV without being dropped", async () => {
  const phrase = phraseFromBlocks(recordings.map(r => seedBlock(r.id)));
  const e = await appendTurn(null, content(null, phrase));
  const wav = Buffer.from(exchangeWav(e));
  for (const r of recordings) { assert.ok(wav.includes(r.audio.sha256)); assert.deepEqual(sourceDescriptor(r.id).originalClickTimesSeconds, r.annotation.clickTimesSeconds); }
});

test("Generation cancellation prevents late reads/hashes from installing an obsolete snapshot", async () => {
  const gate = new Generation(); let applied = "original";
  let finish!: () => void; const blocked = new Promise<void>(r => { finish = r; });
  const old = gate.next(); const task = blocked.then(() => { if (gate.current(old)) applied = "old"; });
  const latest = gate.next(); if (gate.current(latest)) applied = "new";
  finish(); await task; assert.equal(applied, "new");
  gate.next(); assert.equal(gate.current(latest), false);
});
