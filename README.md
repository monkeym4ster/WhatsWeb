# WhatsWeb

网站指纹识别与安全扫描工具。 / Identifies websites.

## Installation

```bash
# 使用 Bun (推荐)
bun install -g whatsweb

# 使用 npm
npm install -g whatsweb
```

## Usage

```bash
whatsweb [options] URLs
```

### Options

```
-V, --version            输出版本号
-f <file>                从文件读取目标列表
-c, --concurrency <num>  并发数 (默认: 50)
--network <mask>          扫描 Target/MASK 网段内所有主机
--timeout <ms>            请求超时毫秒数 (默认: 10000)
--user-agent <string>    自定义 User-Agent
-o, --output <path>      输出文件路径 (JSONL 格式)
--show-error             显示错误信息
-h, --help               显示帮助
```

### Example

```bash
# 扫描单个目标
whatsweb http://example.com

# 扫描多个目标
whatsweb http://a.com http://b.com http://c.com

# 从文件读取 + 并发 20 + 输出到文件
whatsweb -f targets.txt -c 20 -o results.jsonl

# 扫描整个 /24 网段
whatsweb http://192.168.1.1 --network 24
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **HTTP**: Bun native fetch
- **Utilities**: es-toolkit, p-limit, zod
- **Fingerprinting**: wappalyzer@6.10.66
- **GeoIP**: geoip-lite

## Architecture

插件化架构：核心引擎 + 可扩展的插件系统。

内置插件：
- **Base Information** — HTTP 状态、标题、重定向、x-* 头
- **Email** — HTML 中的邮箱地址提取
- **Geolocation** — IP 地理位置
- **Wappalyzer** — 技术栈识别
- **BBScan** — 敏感路径扫描

## Development

```bash
bun install          # 安装依赖
bun test             # 运行测试
bun run lint         # Lint 检查
bun run dev          # 开发运行
```

## License

MIT
