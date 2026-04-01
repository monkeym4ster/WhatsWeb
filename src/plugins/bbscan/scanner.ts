import pLimit from "p-limit";
import { httpGet, httpHead } from "../../utils/http.ts";
import type { ListRule, ScanRule } from "./rule-parser.ts";
import { loadBlackList, loadWhiteList, parseRuleFiles } from "./rule-parser.ts";

export interface BBScannerOptions {
  url: string;
  userAgent: string;
  timeout: number;
}

export class BBScanner {
  private host: string;
  private protocol: string;
  private rules: ScanRule[] = [];
  private whiteList: ListRule = { texts: [], regexes: [] };
  private blackList: ListRule = { texts: [], regexes: [] };

  constructor(private opts: BBScannerOptions) {
    const parsed = new URL(opts.url);
    this.host = parsed.host;
    this.protocol = parsed.protocol;
  }

  async check404(): Promise<boolean> {
    try {
      const res = await httpHead(`${this.protocol}//${this.host}/WhatsWeb-404-existence-check`, {
        timeout: this.opts.timeout,
        userAgent: this.opts.userAgent,
      });
      return res.status === 404;
    } catch {
      return false;
    }
  }

  private findInWhiteList(text: string): boolean {
    if (this.whiteList.texts.some((t) => text.includes(t))) return true;
    return this.whiteList.regexes.some((r) => r.test(text));
  }

  private findInBlackList(text: string): boolean {
    if (this.blackList.texts.some((t) => text.includes(t))) return true;
    return this.blackList.regexes.some((r) => r.test(text));
  }

  async run(): Promise<string[] | false> {
    const has404 = await this.check404();
    if (!has404) return false;

    this.rules = await parseRuleFiles();
    this.whiteList = await loadWhiteList();
    this.blackList = await loadBlackList();

    const limit = pLimit(50);
    const sub = /\d$/.test(this.host) ? this.host.split(".")[3] : this.host.split(".")[0];

    const tasks = this.rules.map((rule) =>
      limit(async (): Promise<string | null> => {
        try {
          let rulePath = rule.uri;
          if (rulePath.includes("{sub}")) rulePath = rulePath.replace(/{sub}/g, sub);
          if (rulePath.includes("{hostname_or_folder}"))
            rulePath = rulePath.replace(/{hostname_or_folder}/g, this.host);
          if (rulePath.includes("{hostname}")) rulePath = rulePath.replace(/{hostname}/g, this.host);

          const needBody = !!rule.tag;
          const fetchFn = needBody ? httpGet : httpHead;
          const res = await fetchFn(`${this.protocol}//${this.host}${rulePath}`, {
            timeout: this.opts.timeout,
            userAgent: this.opts.userAgent,
          });

          const curContentType = res.headers["content-type"] ?? "";

          if (needBody && ["html", "text"].includes(curContentType) && !res.text.length) return null;
          if (curContentType.includes("image/")) return null;

          if (needBody && this.findInWhiteList(res.text)) return rulePath;
          if (needBody && this.findInBlackList(res.text)) return null;

          if (curContentType.includes("application/json") && !rulePath.endsWith(".json")) return null;

          if (res.status === 404) return null;
          if (rule.status && res.status !== rule.status && res.status !== 206) return null;
          if (rule.status !== 403 && res.status === 403) return null;
          if (rule.tag && needBody && !res.text.includes(rule.tag)) return null;
          if (rule.contentType && !curContentType.includes(rule.contentType)) return null;
          if (rule.contentTypeNo && curContentType.includes(rule.contentTypeNo)) return null;

          return rulePath;
        } catch {
          return null;
        }
      }),
    );

    const results = await Promise.all(tasks);
    return results.filter((r): r is string => r !== null);
  }
}
