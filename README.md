# custom-proxy-rules

将公开规则源与你自己的域名、IP/CIDR 和覆盖规则合并，生成可订阅的代理分流规则。

首个版本输出 Shadowrocket 模块，但项目的数据模型和编译流程不绑定具体客户端，后续可增加
Clash、Surge、Quantumult X 和 sing-box 输出器。

## 特点

- 聚合公开的 DIRECT、PROXY、REJECT 数据源
- 支持裸域名、通配域名、IPv4、IPv6、CIDR 和完整规则语法
- 自动规范化、去重、稳定排序并生成冲突报告
- 本地规则优先于公开源，私有规则优先级最高
- 私有目录默认被 Git 忽略，降低内网信息误提交风险
- GitHub Actions 每日自动测试、构建和提交生成结果

## 快速开始

需要 Python 3.11 或更高版本。

```bash
cp -R rules/private.example rules/private
python -m pip install -e .
proxy-rules
```

不下载公开源、只验证本地规则：

```bash
proxy-rules --no-fetch
```

一般用户只需订阅合并模块：

```text
https://raw.githubusercontent.com/3tel/custom-proxy-rules/main/dist/shadowrocket/all.module
```

生成文件位于 `dist/shadowrocket/`：

- `all.module`（推荐，包含全部规则）
- `direct.module`
- `proxy.module`
- `reject.module`

构建统计和前 100 条冲突写入 `build-report.json`。

## 添加自定义规则

公开规则写入 `rules/local/direct.txt`、`proxy.txt` 或 `reject.txt`。真实内网信息写入同名的
`rules/private/` 文件。后者不会被 Git 跟踪。

每行一条，支持以下写法：

```text
example.com
*.internal.example
10.10.0.0/16
fd00::/8
DOMAIN,api.example.com,PROXY
IP-CIDR,203.0.113.0/24,DIRECT,no-resolve
```

裸域名和 `*.域名` 都会转换为 `DOMAIN-SUFFIX`。IP 地址和 CIDR 会自动识别 IPv4/IPv6、
规范网络地址，并添加 `no-resolve`。

## 冲突规则

同一个目标同时出现在多个策略中时，优先级为：

```text
rules/private > rules/local > REJECT 公开源 > PROXY 公开源 > DIRECT 公开源
```

因此可以在 `rules/private/direct.txt` 中把被公开广告源误杀的内部域名强制改为 DIRECT。

## 数据源

数据源在 `config/sources.json` 中声明，目前默认使用：

- [dnsmasq-china-list](https://github.com/felixonmars/dnsmasq-china-list)
- [gfwlist](https://github.com/gfwlist/gfwlist)
- [AdGuard DNS filter](https://github.com/AdguardTeam/AdguardSDNSFilter)

本仓库只在构建时获取并转换这些上游数据。使用或再分发生成规则前，请同时检查各上游项目
的许可证和使用条款。详细边界见 [SOURCES.md](SOURCES.md)。

## 隐私提醒

`.gitignore` 只能避免普通的 `git add` 误操作。不要使用 `git add -f rules/private`，也不要把
含有内部信息的生成文件发布到公共仓库。如果需要跨设备同步真实内网规则，建议使用单独的
私有仓库或加密存储。

## 独立实现说明

本项目借鉴规则项目常见的“远程数据源 + 自动构建 + 模块订阅”工作方式，但解析器、冲突模型、
目录结构、构建器、测试和文档均为独立实现，不包含其他规则仓库的源码或生成文件。

项目最初受到 [GMOogway/shadowrocket-rules](https://github.com/GMOogway/shadowrocket-rules)
模块化交付方式的启发。两者没有代码继承关系；本项目从原始公开数据源独立下载、解析和编译，
并重点提供私有规则隔离、显式优先级与冲突报告。
