/**
 * Minimal, loss-less protobuf passthrough codec, plus a helper that turns
 * YouTube's "open Ask panel" continuation into a "send a question" one.
 *
 * Both continuations are `{ field2:"PAyouchat", field3:<base64 inner> }`, where
 * the inner descriptor is `{f1:1, f2:videoId, f4:clickTracking, f5:{f4:1}}`.
 * The only difference is that the query continuation **drops the `f5` init
 * flag** — so stripping it (and re-sending with `formData.userInputText`)
 * reproduces exactly what the page does when you type a question.
 *
 * The codec only needs to preserve unknown fields byte-for-byte, which it does.
 */

interface PbField {
  field: number;
  tag: Uint8Array;
  wireType: number;
  /** For wire type 2: content bytes. Otherwise the raw value bytes. */
  payload: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlToBytes(value: string): Uint8Array {
  let b64 = decodeURIComponent(value).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBinary(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return bin;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function bytesToBase64Std(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}

function readVarint(buf: Uint8Array, i: number): [Uint8Array, number] {
  const start = i;
  while (i < buf.length && buf[i]! & 0x80) i++;
  i++;
  return [buf.slice(start, i), i];
}

function varintToNumber(bytes: Uint8Array): number {
  let value = 0;
  let shift = 0;
  for (const b of bytes) {
    value |= (b & 0x7f) << shift;
    shift += 7;
  }
  return value >>> 0;
}

function fieldNumber(tag: Uint8Array): number {
  return varintToNumber(tag) >>> 3;
}

function encodeVarint(n: number): Uint8Array {
  const out: number[] = [];
  do {
    let b = n & 0x7f;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return new Uint8Array(out);
}

function decodeFields(buf: Uint8Array): PbField[] {
  const fields: PbField[] = [];
  let i = 0;
  while (i < buf.length) {
    let tag: Uint8Array;
    [tag, i] = readVarint(buf, i);
    const wireType = tag[0]! & 7;
    const field = fieldNumber(tag);
    if (wireType === 0) {
      let value: Uint8Array;
      [value, i] = readVarint(buf, i);
      fields.push({ field, tag, wireType, payload: value });
    } else if (wireType === 2) {
      let lenBytes: Uint8Array;
      [lenBytes, i] = readVarint(buf, i);
      const len = varintToNumber(lenBytes);
      if (i + len > buf.length) throw new Error('length overflow');
      fields.push({ field, tag, wireType, payload: buf.slice(i, i + len) });
      i += len;
    } else if (wireType === 5) {
      fields.push({ field, tag, wireType, payload: buf.slice(i, i + 4) });
      i += 4;
    } else if (wireType === 1) {
      fields.push({ field, tag, wireType, payload: buf.slice(i, i + 8) });
      i += 8;
    } else {
      throw new Error(`unsupported wire type ${wireType}`);
    }
  }
  return fields;
}

function encodeFields(fields: PbField[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const f of fields) {
    parts.push(f.tag);
    if (f.wireType === 2) parts.push(encodeVarint(f.payload.length));
    parts.push(f.payload);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Convert an "open Ask panel" continuation into a "send a question" one by
 * stripping the inner init flag (field 5). Returns null if the continuation
 * doesn't have the expected PAyouchat shape (caller then falls back).
 */
export function deriveAskQueryContinuation(continuation: string): string | null {
  let fields: PbField[];
  try {
    fields = decodeFields(base64UrlToBytes(continuation));
  } catch {
    return null;
  }

  for (const f of fields) {
    if (f.wireType !== 2) continue;
    let panel: PbField[];
    try {
      panel = decodeFields(f.payload);
    } catch {
      continue;
    }
    const isPanel = panel.some(
      (p) => p.wireType === 2 && decoder.decode(p.payload) === 'PAyouchat',
    );
    if (!isPanel) continue;

    const f3 = panel.find((p) => p.field === 3 && p.wireType === 2);
    if (!f3) return null;

    const f3text = decoder.decode(f3.payload);
    const urlEncoded = f3text.includes('%');
    let inner: PbField[];
    try {
      inner = decodeFields(base64UrlToBytes(f3text));
    } catch {
      return null;
    }

    let changed = false;
    for (const g of inner) {
      if (g.wireType !== 2) continue;
      let descriptor: PbField[];
      try {
        descriptor = decodeFields(g.payload);
      } catch {
        continue;
      }
      const filtered = descriptor.filter((d) => d.field !== 5);
      if (filtered.length !== descriptor.length) {
        g.payload = encodeFields(filtered);
        changed = true;
      }
    }
    if (!changed) return null;

    const newInnerBytes = encodeFields(inner);
    const newF3 = urlEncoded
      ? bytesToBase64Std(newInnerBytes).replace(/=/g, '%3D')
      : bytesToBase64Url(newInnerBytes);
    f3.payload = encoder.encode(newF3);
    f.payload = encodeFields(panel);
    return bytesToBase64Url(encodeFields(fields));
  }
  return null;
}
