import { resolve4 as dnsResolve4 } from "node:dns/promises";
import { isIPv4 } from "node:net";

export async function resolve4(domain: string): Promise<string> {
  if (isIPv4(domain)) return domain;
  const addresses = await dnsResolve4(domain);
  if (!addresses.length) throw new Error(`DNS resolve failed for ${domain}`);
  return addresses[0];
}
