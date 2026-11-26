/**
 * `TextEncoder` and `TextDecoder` do not exist in QuickJS. Only UTF-8 is
 * supported, which is the label every QChat API speaks; other labels raise a
 * `RangeError` instead of silently guessing.
 */

const REPLACEMENT = 0xfffd;

function byteArray(bytes: ArrayLike<number>): Uint8Array | number[] {
  const scope = globalThis as unknown as { Uint8Array?: typeof Uint8Array };
  if (typeof scope.Uint8Array === "function") return new scope.Uint8Array(bytes.length);
  return [];
}

export class QappTextEncoder {
  readonly encoding = "utf-8";

  encode(input = ""): Uint8Array {
    const text = String(input);
    const output: number[] = [];
    for (let index = 0; index < text.length; index++) {
      let code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
          index++;
        }
      }
      if (code >= 0xd800 && code <= 0xdfff) {
        // A lone surrogate encodes as the replacement character.
        output.push(0xef, 0xbf, 0xbd);
        continue;
      }
      if (code < 0x80) {
        output.push(code);
      } else if (code < 0x800) {
        output.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        output.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      } else {
        output.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      }
    }
    const target = byteArray(output);
    for (let index = 0; index < output.length; index++) {
      (target as number[])[index] = output[index];
    }
    return target as Uint8Array;
  }

}

export class QappTextDecoder {
  readonly encoding = "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;

  constructor(
    label = "utf-8",
    options: { fatal?: boolean; ignoreBOM?: boolean } = {},
  ) {
    const normalized = String(label).trim().toLowerCase();
    if (!["utf-8", "utf8", "unicode-1-1-utf-8"].includes(normalized)) {
      throw new RangeError(`The encoding "${label}" is not supported`);
    }
    this.fatal = options.fatal === true;
    this.ignoreBOM = options.ignoreBOM === true;
  }

  decode(input?: ArrayLike<number> | null, options: { stream?: boolean } = {}): string {
    void options;
    if (input === undefined || input === null) return "";
    const bytes: number[] = [];
    for (let index = 0; index < input.length; index++) {
      const byte = Number(input[index]);
      bytes.push(byte < 0 ? 0 : byte > 255 ? 255 : Math.floor(byte));
    }
    let start = 0;
    if (!this.ignoreBOM && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      start = 3;
    }
    let output = "";
    for (let index = start; index < bytes.length; ) {
      const first = bytes[index];
      let size = 1;
      let code = first;
      if (first >= 0xf0) {
        size = 4;
        code = first & 0x07;
      } else if (first >= 0xe0) {
        size = 3;
        code = first & 0x0f;
      } else if (first >= 0xc0) {
        size = 2;
        code = first & 0x1f;
      } else if (first >= 0x80) {
        if (this.fatal) throw new TypeError("The encoded data was not valid UTF-8");
        output += String.fromCharCode(REPLACEMENT);
        index++;
        continue;
      }
      if (index + size > bytes.length) {
        // A truncated sequence at the end of the input: report the replacement
        // character and resynchronise at the next byte.
        if (this.fatal) throw new TypeError("The encoded data was not valid UTF-8");
        output += String.fromCharCode(REPLACEMENT);
        index++;
        continue;
      }
      let valid = true;
      for (let offset = 1; offset < size; offset++) {
        const continuation = bytes[index + offset];
        if ((continuation & 0xc0) !== 0x80) {
          valid = false;
          break;
        }
        code = (code << 6) | (continuation & 0x3f);
      }
      if (!valid) {
        if (this.fatal) throw new TypeError("The encoded data was not valid UTF-8");
        output += String.fromCharCode(REPLACEMENT);
        index++;
        continue;
      }
      if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        if (this.fatal) throw new TypeError("The encoded data was not valid UTF-8");
        output += String.fromCharCode(REPLACEMENT);
        index += size;
        continue;
      }
      if (code > 0xffff) {
        const adjusted = code - 0x10000;
        output += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
      } else {
        output += String.fromCharCode(code);
      }
      index += size;
    }
    return output;
  }
}

let installed = false;

export function installEncoding(): void {
  if (installed) return;
  installed = true;
  const scope = globalThis as unknown as Record<string, unknown>;
  scope.TextEncoder = QappTextEncoder;
  scope.TextDecoder = QappTextDecoder;
}
