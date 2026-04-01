export function ipToLong(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error(`Invalid IP address: ${ip}`);
  let result = 0;
  for (const part of parts) {
    const n = Number.parseInt(part, 10);
    if (Number.isNaN(n) || n < 0 || n > 255) throw new Error(`Invalid IP address: ${ip}`);
    result = (result >>> 0) * 256 + n;
  }
  return result >>> 0;
}

export function longToIp(long: number): string {
  return [(long >>> 24) & 0xff, (long >>> 16) & 0xff, (long >>> 8) & 0xff, long & 0xff].join(".");
}

export function* expandCIDR(cidr: string): Generator<string> {
  const parts = cidr.split("/");
  if (parts.length !== 2) throw new Error(`Invalid CIDR: ${cidr}`);

  const ip = parts[0];
  const mask = Number.parseInt(parts[1], 10);
  if (Number.isNaN(mask) || mask < 0 || mask > 32) throw new Error(`Invalid CIDR mask: ${cidr}`);

  const ipLong = ipToLong(ip);
  const hostBits = 32 - mask;

  if (mask === 32) {
    yield longToIp(ipLong);
    return;
  }

  const networkAddr = (ipLong >>> hostBits) << hostBits;
  const totalHosts = 1 << hostBits;

  if (mask === 31) {
    for (let i = 0; i < totalHosts; i++) {
      yield longToIp((networkAddr + i) >>> 0);
    }
    return;
  }

  for (let i = 1; i < totalHosts - 1; i++) {
    yield longToIp((networkAddr + i) >>> 0);
  }
}
