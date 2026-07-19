export type ZipInput = { bytes: Uint8Array; name: string };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function createZip(inputs: ZipInput[]) {
  const encoder = new TextEncoder();
  const names = new Set<string>();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const input of inputs) {
    if (
      !input.name ||
      input.name.startsWith("/") ||
      input.name
        .split("/")
        .some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("Unsafe ZIP path");
    }
    if (names.has(input.name)) throw new Error("Duplicate ZIP path");
    names.add(input.name);
    const name = encoder.encode(input.name);
    const crc = crc32(input.bytes);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0x21),
      u32(crc),
      u32(input.bytes.length),
      u32(input.bytes.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(local, input.bytes);
    centralParts.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0x21),
        u32(crc),
        u32(input.bytes.length),
        u32(input.bytes.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(localOffset),
        name,
      ]),
    );
    localOffset += local.length + input.bytes.length;
  }
  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(inputs.length),
    u16(inputs.length),
    u32(central.length),
    u32(localOffset),
    u16(0),
  ]);
  return concat([...localParts, central, end]);
}
