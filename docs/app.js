const form = document.querySelector("#generator");
const nodeInput = document.querySelector("#nodes");
const messages = document.querySelector("#messages");
const summary = document.querySelector("#summary");
const status = document.querySelector("#status");

document.querySelector("#clear").addEventListener("click", () => { nodeInput.value = ""; updateSummary(); nodeInput.focus(); });
nodeInput.addEventListener("input", updateSummary);
document.querySelectorAll(".rule-tabs button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".rule-tabs button,.rule-input").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  document.querySelector(`#custom-${button.dataset.rule}`).classList.add("active");
}));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  messages.textContent = "";
  try {
    const lines = nodeInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error("请至少添加一个节点分享链接。");
    const nodes = uniqueNames(lines.map(parseNode));
    const config = buildConfig(nodes);
    const requestedName = document.querySelector("#filename").value.trim() || "custom-proxy";
    download(`${safeName(requestedName)}.conf`, config);
    summary.textContent = `已生成 ${nodes.length} 个节点`;
    status.textContent = "配置已在本地生成并开始下载，页面没有保存节点信息。";
  } catch (error) {
    messages.textContent = error.message;
  }
});

function updateSummary() {
  const count = nodeInput.value.split(/\r?\n/).filter((line) => line.trim()).length;
  summary.textContent = count ? `已添加 ${count} 条节点链接` : "等待添加节点";
  status.textContent = "节点名称、UUID 和密码不会离开此页面。";
}

function parseNode(value) {
  const scheme = value.match(/^([a-z0-9-]+):\/\//i)?.[1]?.toLowerCase();
  if (scheme === "vless") return parseStandard(value, "vless");
  if (scheme === "trojan") return parseStandard(value, "trojan");
  if (scheme === "ss") return parseShadowsocks(value);
  if (scheme === "vmess") return parseVmess(value);
  throw new Error(`暂不支持的节点链接：${value.slice(0, 18)}…`);
}

function parseStandard(value, protocol) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${protocol.toUpperCase()} 链接格式无效。`); }
  if (!url.username || !url.hostname || !url.port) throw new Error(`${protocol.toUpperCase()} 链接缺少身份、地址或端口。`);
  const q = url.searchParams;
  const name = decodeHash(url.hash) || `${protocol.toUpperCase()} ${url.hostname}`;
  const security = q.get("security") || (protocol === "trojan" ? "tls" : "none");
  const transport = q.get("type") || "tcp";
  const options = [`password=${decodeURIComponent(url.username)}`];
  if (security === "tls" || security === "reality" || protocol === "trojan") options.push("tls=true");
  const sni = q.get("sni") || q.get("peer");
  if (sni) options.push(`peer=${clean(sni)}`);
  if (q.get("allowInsecure") === "1") options.push("skip-cert-verify=true");
  if (transport === "ws") {
    options.push("obfs=websocket");
    const host = q.get("host"); if (host) options.push(`obfs-host=${clean(host)}`);
    const path = q.get("path"); if (path) options.push(`obfs-uri=${clean(path)}`);
  } else if (transport === "grpc") {
    options.push("obfs=grpc");
    const service = q.get("serviceName"); if (service) options.push(`grpc-service-name=${clean(service)}`);
  } else if (transport !== "tcp" && transport !== "none") {
    options.push(`obfs=${clean(transport)}`);
    const path = q.get("path"); if (path) options.push(`obfs-uri=${clean(path)}`);
  }
  if (security === "reality") {
    if (q.get("pbk")) options.push(`pbk=${clean(q.get("pbk"))}`);
    if (q.get("sid")) options.push(`sid=${clean(q.get("sid"))}`);
    if (q.get("fp")) options.push(`fingerprint=${clean(q.get("fp"))}`);
  }
  if (q.get("flow")) options.push(`flow=${clean(q.get("flow"))}`);
  options.push("udp=true");
  return { name: cleanName(name), line: `${cleanName(name)}=${protocol},${host(url.hostname)},${url.port},${options.join(",")}` };
}

function parseVmess(value) {
  let data;
  try { data = JSON.parse(decodeBase64(value.slice(8))); } catch { throw new Error("VMess 链接不是有效的 Base64 JSON。"); }
  if (!data.add || !data.port || !data.id) throw new Error("VMess 链接缺少地址、端口或 UUID。");
  const name = cleanName(data.ps || `VMESS ${data.add}`);
  const options = [`password=${clean(data.id)}`, `alterId=${clean(String(data.aid || 0))}`, "method=auto"];
  if (data.tls === "tls") options.push("tls=true");
  if (data.sni) options.push(`peer=${clean(data.sni)}`);
  if (data.net === "ws") {
    options.push("obfs=websocket");
    if (data.host) options.push(`obfs-host=${clean(data.host)}`);
    if (data.path) options.push(`obfs-uri=${clean(data.path)}`);
  }
  options.push("udp=true");
  return { name, line: `${name}=vmess,${host(String(data.add))},${clean(String(data.port))},${options.join(",")}` };
}

function parseShadowsocks(value) {
  const body = value.slice(5);
  const hashIndex = body.indexOf("#");
  const name = hashIndex >= 0 ? decodeURIComponent(body.slice(hashIndex + 1)) : "Shadowsocks";
  const withoutHash = hashIndex >= 0 ? body.slice(0, hashIndex) : body;
  const queryIndex = withoutHash.indexOf("?");
  const core = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  let credentials, endpoint;
  if (core.includes("@")) [credentials, endpoint] = core.split("@");
  else {
    const decoded = decodeBase64(core);
    const at = decoded.lastIndexOf("@");
    if (at < 0) throw new Error("Shadowsocks 链接格式无效。");
    credentials = decoded.slice(0, at); endpoint = decoded.slice(at + 1);
  }
  if (!credentials.includes(":")) credentials = decodeBase64(credentials);
  const separator = credentials.indexOf(":");
  const method = credentials.slice(0, separator); const password = credentials.slice(separator + 1);
  const match = endpoint.match(/^\[?([^\]]+)\]?:(\d+)$/);
  if (!match || !method || !password) throw new Error("Shadowsocks 链接缺少加密方式、密码或地址。");
  const safe = cleanName(name || `SS ${match[1]}`);
  return { name: safe, line: `${safe}=ss,${host(match[1])},${match[2]},password=${clean(password)},method=${clean(method)},udp=true` };
}

function buildConfig(nodes) {
  const names = nodes.map((node) => node.name).join(", ");
  const mode = document.querySelector("#group-mode").value;
  const groupExtra = mode === "url-test" ? ", url=http://www.gstatic.com/generate_204, interval=600, tolerance=50" : mode === "fallback" ? ", url=http://www.gstatic.com/generate_204, interval=600" : "";
  const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}rules`;
  const custom = [
    ...customRules("reject", "REJECT"),
    ...customRules("proxy", "PROXY"),
    ...customRules("direct", "DIRECT"),
  ];
  return [
    "# Generated locally by custom-proxy-rules", `# ${new Date().toISOString()}`, "",
    "[General]", "bypass-system = true", "ipv6 = true", `dns-server = ${clean(document.querySelector("#dns").value)}`,
    "skip-proxy = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, localhost, *.local", "",
    "[Proxy]", ...nodes.map((node) => node.line), "",
    "[Proxy Group]", `PROXY = ${mode}, ${names}${groupExtra}`, "",
    "[Rule]", ...custom,
    `RULE-SET,${base}/reject.list,REJECT`, `RULE-SET,${base}/proxy.list,PROXY`, `RULE-SET,${base}/direct.list,DIRECT`,
    "GEOIP,CN,DIRECT", `FINAL,${document.querySelector("#final-policy").value}`, "",
  ].join("\n");
}

function customRules(id, action) {
  return document.querySelector(`#custom-${id}`).value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
    if (line.includes(",")) return line;
    if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(line)) return `IP-CIDR,${line.includes("/") ? line : `${line}/32`},${action},no-resolve`;
    if (line.includes(":")) return `IP-CIDR6,${line.includes("/") ? line : `${line}/128`},${action},no-resolve`;
    return `DOMAIN-SUFFIX,${line.replace(/^\*\./, "").toLowerCase()},${action}`;
  });
}

function uniqueNames(nodes) {
  const counts = new Map();
  return nodes.map((node) => {
    const count = (counts.get(node.name) || 0) + 1; counts.set(node.name, count);
    if (count === 1) return node;
    const name = `${node.name} ${count}`;
    return { name, line: node.line.replace(/^[^=]+=/, `${name}=`) };
  });
}

function decodeBase64(value) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); return decodeURIComponent(escape(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")))); }
function decodeHash(hash) { try { return decodeURIComponent(hash.replace(/^#/, "")); } catch { return hash.replace(/^#/, ""); } }
function host(value) { return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value; }
function clean(value) { return String(value).replace(/[\r\n,]/g, "").trim(); }
function cleanName(value) { return clean(value).replace(/=/g, "-").slice(0, 80) || "Unnamed"; }
function safeName(value) { return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "custom-proxy"; }
function download(name, content) { const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })); const link = Object.assign(document.createElement("a"), { href: url, download: name }); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
