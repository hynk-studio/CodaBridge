import { Generation } from "./format.ts";
import type { Envelope } from "./model.ts";
import type { PreparedSeal, SealedArtifact } from "./sealed.ts";

export interface OpenContent<D> { envelope: Envelope | null; outgoing: D | null }
export interface Session<D> extends OpenContent<D> {
  mode: "plain" | "private" | "locked";
  encrypted: SealedArtifact | null;
  sealedDigest: string | null;
  prepared: PreparedSeal | null;
  keySaved: boolean;
}
const empty = <D,>(): Session<D> => ({ mode: "plain", envelope: null, outgoing: null, encrypted: null, sealedDigest: null, prepared: null, keySaved: false });

// The component owns this one session. React subscribes to a revision counter,
// not a second copy of decrypted state. Lock drops all content/key references.
export class SessionOwner<D> {
  current: Session<D> = empty<D>();
  phase: "idle" | "reading" | "hashing" | "sealing" | "unlocking" = "idle";
  get pending() { return this.phase !== "idle"; }
  setPhase(value: SessionOwner<D>["phase"]) { this.phase = value; this.revision++; this.listeners.forEach(f => f()); }
  generation = new Generation();
  private revision = 0;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.revision;
  private replace(value: Session<D>) { if (this.current.prepared && this.current.prepared !== value.prepared) this.current.prepared.code = ""; this.current = value; this.revision++; this.listeners.forEach(f => f()); }
  install(value: OpenContent<D>) {
    const current = this.current;
    this.replace({ ...current, ...value, prepared: value.envelope?.digest === current.envelope?.digest ? current.prepared : null,
      keySaved: value.envelope?.digest === current.envelope?.digest ? current.keySaved : false });
  }
  privateMode() { if (this.current.mode === "plain") this.replace({ ...this.current, mode: "private" }); }
  reset() { this.setPhase("idle"); this.generation.next(); this.replace(empty<D>()); }
  acceptPlain(envelope: Envelope) { this.generation.next(); this.replace({ ...empty<D>(), envelope }); }
  acceptLocked(encrypted: SealedArtifact) { this.generation.next(); this.replace({ ...empty<D>(), mode: "locked", encrypted }); }
  acceptUnlocked(envelope: Envelope, encrypted: SealedArtifact) {
    const outgoing = this.current.envelope?.digest === envelope.digest ? this.current.outgoing : null;
    this.generation.next();
    this.replace({ ...empty<D>(), mode: "private", envelope, outgoing, encrypted, sealedDigest: envelope.digest });
  }
  prepared(value: PreparedSeal, digest: string, token: number) {
    if (!this.generation.current(token) || this.current.mode !== "private" || this.current.outgoing || this.current.envelope?.digest !== digest) { value.code = ""; return false; }
    this.replace({ ...this.current, encrypted: value.artifact, sealedDigest: digest, prepared: value, keySaved: false }); return true;
  }
  acknowledge(value: boolean) { this.replace({ ...this.current, keySaved: value }); }
  lock() {
    this.setPhase("idle"); this.generation.next();
    const encrypted = this.current.encrypted;
    if (this.current.prepared) this.current.prepared.code = "";
    this.replace({ ...empty<D>(), mode: "locked", encrypted });
  }
  readyArtifact() {
    const s = this.current;
    return s.mode === "private" && !s.outgoing && s.envelope?.digest === s.sealedDigest && (!s.prepared || s.keySaved) ? s.encrypted : null;
  }
  unsavedChanges() { const s = this.current; return Boolean(s.outgoing || (s.envelope && s.envelope.digest !== s.sealedDigest)); }
}
