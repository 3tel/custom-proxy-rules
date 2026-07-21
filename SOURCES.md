# 数据来源与许可

`custom-proxy-rules` 的编译器代码采用 MIT License。构建时下载的第三方规则数据不因经过
本项目转换而自动变为 MIT License；相应数据仍由其作者拥有，并受各自许可和使用条款约束。

| 名称 | 用途 | 上游项目 | 许可 |
| --- | --- | --- | --- |
| dnsmasq-china-list | DIRECT 域名 | https://github.com/felixonmars/dnsmasq-china-list | WTFPL v2，以其仓库为准 |
| gfwlist | PROXY 域名 | https://github.com/gfwlist/gfwlist | 以上游仓库说明为准 |
| AdGuard DNS filter | REJECT 域名 | https://github.com/AdguardTeam/AdguardSDNSFilter | 以上游仓库说明为准 |

具体下载地址和解析格式记录在 `config/sources.json`。项目不会把其他聚合规则仓库作为下载源，
也不会复制它们已经生成的 DIRECT、PROXY 或 REJECT 文件。

如果发布 `dist/` 中的聚合结果，发布者有责任确认所有启用数据源的最新许可要求。第三方源可能
随时改变许可或内容，本文件不构成法律意见。

