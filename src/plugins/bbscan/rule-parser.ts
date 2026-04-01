import path from "node:path";
import { z } from "zod";

export const scanRuleSchema = z.object({
  uri: z.string().startsWith("/"),
  tag: z.string().default(""),
  status: z.number().int().min(100).max(599).nullable().default(null),
  contentType: z.string().default(""),
  contentTypeNo: z.string().default(""),
  rootOnly: z.boolean().default(false),
});

export type ScanRule = z.infer<typeof scanRuleSchema>;

export interface ListRule {
  texts: string[];
  regexes: RegExp[];
}

const regTag = /{tag="(.*?)"}/;
const regStatus = /{status=(\d{3})}/;
const regContentType = /{type="(.*?)"}/;
const regContentTypeNo = /{type_no="(.*?)"}/;
const regText = /{text="(.*)"}/;
const regRegexText = /{regex_text="(.*)"}/;

export function parseRuleLine(line: string): ScanRule | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return null;

  const uri = trimmed.split(/\s+/)[0];

  let m = trimmed.match(regTag);
  const tag = m?.[1] ?? "";

  m = trimmed.match(regStatus);
  const status = m?.[1] ? Number.parseInt(m[1], 10) : null;

  m = trimmed.match(regContentType);
  const contentType = m?.[1] ?? "";

  m = trimmed.match(regContentTypeNo);
  const contentTypeNo = m?.[1] ?? "";

  const rootOnly = trimmed.includes("{root_only}");

  const parsed = scanRuleSchema.safeParse({ uri, tag, status, contentType, contentTypeNo, rootOnly });
  return parsed.success ? parsed.data : null;
}

export function parseListFile(content: string): ListRule {
  const texts: string[] = [];
  const regexes: RegExp[] = [];

  for (const l of content.split("\n")) {
    const line = l.trim();
    if (!line || line.startsWith("#")) continue;

    let m = line.match(regText);
    if (m?.[1]) {
      texts.push(m[1]);
      continue;
    }

    m = line.match(regRegexText);
    if (m?.[1]) {
      regexes.push(new RegExp(m[1], "i"));
    }
  }

  return { texts, regexes };
}

function getDefaultRulesDir(): string {
  return path.join(import.meta.dir, "../../../rules");
}

export async function parseRuleFiles(rulesDir?: string): Promise<ScanRule[]> {
  const dir = rulesDir ?? getDefaultRulesDir();
  const rules: ScanRule[] = [];
  const glob = new Bun.Glob("*.txt");

  for await (const file of glob.scan({ cwd: dir })) {
    const content = await Bun.file(path.join(dir, file)).text();
    for (const line of content.split("\n")) {
      const rule = parseRuleLine(line);
      if (rule) rules.push(rule);
    }
  }

  return rules;
}

export async function loadWhiteList(rulesDir?: string): Promise<ListRule> {
  const dir = rulesDir ?? getDefaultRulesDir();
  const content = await Bun.file(path.join(dir, "white.list")).text();
  return parseListFile(content);
}

export async function loadBlackList(rulesDir?: string): Promise<ListRule> {
  const dir = rulesDir ?? getDefaultRulesDir();
  const content = await Bun.file(path.join(dir, "black.list")).text();
  return parseListFile(content);
}
