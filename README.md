# custom-proxy-rules

将公开规则源与你自己的域名、IP/CIDR 和覆盖规则合并，并在浏览器本地把代理节点链接生成
可下载的 Shadowrocket 配置。

首个版本输出 Shadowrocket 模块，但项目的数据模型和编译流程不绑定具体客户端，后续可增加
Clash、Surge、Quantumult X 和 sing-box 输出器。

## 特点

- 聚合公开的 DIRECT、PROXY、REJECT 数据源
- 支持裸域名、通配域名、IPv4、IPv6、CIDR 和完整规则语法
- 自动规范化、去重、稳定排序并生成冲突报告
- 本地规则优先于公开源，私有规则优先级最高
- 私有目录默认被 Git 忽略，降低内网信息误提交风险
- 静态网页支持 VLESS、VMess、Trojan 和 Shadowsocks 分享链接
- 节点凭据只在浏览器本地处理，不上传、不存储
- GitHub Actions 每日自动测试、构建规则并部署 GitHub Pages

## 快速开始

普通用户直接打开在线生成器：

https://3tel.github.io/custom-proxy-rules/

粘贴节点链接、选择策略，然后点击“生成并下载”。网页会生成包含 `[Proxy]`、`[Proxy Group]`
和远程分流规则引用的临时 `.conf` 文件。节点 UUID、密码和服务器信息不会离开当前浏览器。

本地构建需要 Node.js 20 或更高版本：

```bash
cp -R rules/private.example rules/private
npm test
npm run build
```

不下载公开源、只验证本地规则：

```bash
npm run build:local
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
- `direct.list`、`proxy.list`、`reject.list`（供网页生成的配置引用）

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
