export function sha(bytes: Uint8Array | string): string;
export function decryptArtifact(bytes: Uint8Array, code: string): Buffer;
export function encryptPublicFixture(plain: Uint8Array, raw: Uint8Array, iv: Buffer): Buffer;
export function verifyManifest(path: string): unknown;
