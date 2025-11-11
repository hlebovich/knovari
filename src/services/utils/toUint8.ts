export function toUint8(
  data: Uint8Array | ArrayBuffer | number[] | { buffer: ArrayBuffer }
): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }

  if (data && data.buffer) {
    return new Uint8Array(data.buffer);
  }

  throw new Error("Unsupported slice data type");
}
