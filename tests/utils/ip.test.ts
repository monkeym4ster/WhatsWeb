import { describe, test, expect } from "bun:test";
import { expandCIDR, ipToLong, longToIp } from "../../src/utils/ip.ts";

describe("ipToLong / longToIp", () => {
  test("IP 与长整型互转", () => {
    expect(ipToLong("192.168.1.1")).toBe(3232235777);
    expect(longToIp(3232235777)).toBe("192.168.1.1");
  });

  test("边界值: 0.0.0.0 和 255.255.255.255", () => {
    expect(ipToLong("0.0.0.0")).toBe(0);
    expect(ipToLong("255.255.255.255")).toBe(4294967295);
    expect(longToIp(0)).toBe("0.0.0.0");
    expect(longToIp(4294967295)).toBe("255.255.255.255");
  });
});

describe("expandCIDR", () => {
  test("/30 网段应展开为 2 个可用地址", () => {
    const ips = [...expandCIDR("192.168.1.0/30")];
    expect(ips).toEqual(["192.168.1.1", "192.168.1.2"]);
  });

  test("/32 网段应展开为 1 个地址", () => {
    const ips = [...expandCIDR("192.168.1.100/32")];
    expect(ips).toEqual(["192.168.1.100"]);
  });

  test("/24 网段应展开为 254 个地址", () => {
    const ips = [...expandCIDR("10.0.0.0/24")];
    expect(ips.length).toBe(254);
    expect(ips[0]).toBe("10.0.0.1");
    expect(ips[253]).toBe("10.0.0.254");
  });

  test("非法 CIDR 应抛出错误", () => {
    expect(() => [...expandCIDR("invalid")]).toThrow();
  });
});
