import { describe, test, expect } from "bun:test";
import {
  parseRuleLine,
  parseRuleFiles,
  parseListFile,
} from "../../../src/plugins/bbscan/rule-parser.ts";

describe("parseRuleLine", () => {
  test("解析完整规则行", () => {
    const line = '/admin.php    {status=200}    {tag="type=\\"password\\""}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule).not.toBeNull();
    expect(rule?.uri).toBe("/admin.php");
    expect(rule?.status).toBe(200);
    expect(rule?.rootOnly).toBe(true);
  });

  test("解析仅有 URI 和 status 的行", () => {
    const line = '/core              {status=200}     {tag="ELF"}       {root_only}';
    const rule = parseRuleLine(line);
    expect(rule?.uri).toBe("/core");
    expect(rule?.status).toBe(200);
    expect(rule?.tag).toBe("ELF");
    expect(rule?.rootOnly).toBe(true);
  });

  test("解析含 content-type 的行", () => {
    const line = '/debug.txt         {status=200}     {type="text/plain"}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule?.contentType).toBe("text/plain");
    expect(rule?.contentTypeNo).toBe("");
  });

  test("解析含 type_no 的行", () => {
    const line =
      '/config/database.yml       {status=200}    {type_no="html"}  {tag="password"}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule?.contentTypeNo).toBe("html");
    expect(rule?.tag).toBe("password");
  });

  test("跳过注释行", () => {
    expect(parseRuleLine("# This is a comment")).toBeNull();
  });

  test("跳过非 / 开头的行", () => {
    expect(parseRuleLine("not a rule")).toBeNull();
    expect(parseRuleLine("")).toBeNull();
  });
});

describe("parseListFile", () => {
  test("解析白名单文件内容", () => {
    const content = `
# comment
{text="<title>Index of"}
{text="<title>phpMyAdmin</title>"}
{regex_text="<title>.*后台.*</title>"}
    `.trim();
    const result = parseListFile(content);
    expect(result.texts).toContain("<title>Index of");
    expect(result.texts).toContain("<title>phpMyAdmin</title>");
    expect(result.regexes.length).toBe(1);
    expect(result.regexes[0].test("<title>管理后台系统</title>")).toBe(true);
  });

  test("跳过空行和注释", () => {
    const content = '# comment\n\n{text="valid"}';
    const result = parseListFile(content);
    expect(result.texts).toEqual(["valid"]);
  });
});

describe("parseRuleFiles", () => {
  test("从 rules/ 目录加载真实规则文件", async () => {
    const rules = await parseRuleFiles();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.uri).toMatch(/^\//);
    }
  });
});
