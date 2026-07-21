import { isIP } from "node:net";

export const ACTIONS = ["DIRECT", "PROXY", "REJECT"];
export const ACTION_PRIORITY = { DIRECT: 10, PROXY: 20, REJECT: 30 };
const KINDS = new Set(["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "IP-CIDR", "IP-CIDR6", "GEOIP"]);
const DOMAIN_PATTERN = /^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]{1,63}$/i;

export class RuleParseError extends Error {}

export function normalizeDomain(input) {
  const domain = input.trim().replace(/\.$/, "").toLowerCase();
  if (!DOMAIN_PATTERN.test(domain)) throw new RuleParseError(`invalid domain: ${input}`);
  return new URL(`https://${domain}`).hostname;
}

export function parseRule(input, action, source = "unknown", priority = 0) {
  const line = input.trim();
  if (!line || /^[#;!]/.test(line)) return null;

  if (line.includes(",")) {
    const parts = line.split(",").map((part) => part.trim());
    const kind = parts[0].toUpperCase();
    if (!KINDS.has(kind) || parts.length < 2) throw new RuleParseError(`unsupported rule: ${input}`);
    const ruleAction = (parts[2] || action).toUpperCase();
    if (!ACTIONS.includes(ruleAction)) throw new RuleParseError(`invalid action: ${ruleAction}`);
    return makeRule(kind, normalizeValue(kind, parts[1]), ruleAction, parts.slice(3).includes("no-resolve"), source, priority);
  }

  if (line.startsWith("*.")) return makeRule("DOMAIN-SUFFIX", normalizeDomain(line.slice(2)), action, false, source, priority);
  const network = normalizeNetwork(line);
  if (network) return makeRule(network.kind, network.value, action, true, source, priority);
  return makeRule("DOMAIN-SUFFIX", normalizeDomain(line), action, false, source, priority);
}

export function parseText(text, action, source, priority) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    try {
      const rule = parseRule(line, action, source, priority);
      return rule ? [rule] : [];
    } catch (error) {
      throw new RuleParseError(`${source}:${index + 1}: ${error.message}`);
    }
  });
}

export function parseRemote(text, format, action, source, priority) {
  if (format === "plain") return parseText(text, action, source, priority);
  let domains = [];
  if (format === "dnsmasq") {
    domains = text.split(/\r?\n/).map((line) => line.match(/^server=\/([^/]+)\//)?.[1]).filter(Boolean);
  } else if (format === "adblock") {
    domains = adblockDomains(text);
  } else if (format === "gfwlist") {
    const decoded = Buffer.from(text.replace(/\s/g, ""), "base64").toString("utf8");
    domains = adblockDomains(decoded);
  } else {
    throw new RuleParseError(`unsupported source format: ${format}`);
  }
  return domains.flatMap((domain) => {
    try {
      return [makeRule("DOMAIN-SUFFIX", normalizeDomain(domain), action, false, source, priority)];
    } catch {
      return [];
    }
  });
}

export function resolveRules(candidates) {
  const selected = new Map();
  const conflicts = [];
  for (const rule of candidates) {
    const existing = selected.get(rule.key);
    if (!existing) {
      selected.set(rule.key, rule);
    } else if (existing.action !== rule.action) {
      const [winner, loser] = rule.priority > existing.priority ? [rule, existing] : [existing, rule];
      selected.set(rule.key, winner);
      conflicts.push({ kind: rule.kind, value: rule.value, keptAction: winner.action, keptSource: winner.source, discardedAction: loser.action, discardedSource: loser.source });
    }
  }
  return { rules: [...selected.values()], conflicts };
}

function makeRule(kind, value, action, noResolve, source, priority) {
  return {
    kind, value, action, noResolve, source, priority,
    key: `${kind}\0${value}`,
    render() { return [kind, value, action, noResolve && kind.startsWith("IP-CIDR") ? "no-resolve" : null].filter(Boolean).join(","); },
    renderList() { return [kind, value, noResolve && kind.startsWith("IP-CIDR") ? "no-resolve" : null].filter(Boolean).join(","); },
  };
}

function normalizeValue(kind, value) {
  if (kind === "DOMAIN" || kind === "DOMAIN-SUFFIX") return normalizeDomain(value);
  if (kind === "DOMAIN-KEYWORD") return value.trim().toLowerCase();
  if (kind === "IP-CIDR" || kind === "IP-CIDR6") {
    const network = normalizeNetwork(value);
    if (!network || network.kind !== kind) throw new RuleParseError(`${kind} does not match ${value}`);
    return network.value;
  }
  return value.trim().toLowerCase();
}

function normalizeNetwork(input) {
  const [address, prefixText] = input.trim().split("/");
  const version = isIP(address);
  if (!version) return null;
  const max = version === 6 ? 128 : 32;
  const prefix = prefixText === undefined ? max : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) throw new RuleParseError(`invalid network: ${input}`);
  if (version === 6) return { kind: "IP-CIDR6", value: `${address.toLowerCase()}/${prefix}` };
  const parts = address.split(".").map(Number);
  let number = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  number &= mask;
  return { kind: "IP-CIDR", value: `${[number >>> 24, (number >>> 16) & 255, (number >>> 8) & 255, number & 255].join(".")}/${prefix}` };
}

function adblockDomains(text) {
  return text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("!") || line.startsWith("[") || line.startsWith("@@")) return [];
    const match = line.match(/^\|\|([^/^$*|]+)(?:\^|\$|$)/);
    if (match) return [match[1]];
    if (/^https?:\/\//.test(line)) {
      try { return [new URL(line).hostname]; } catch { return []; }
    }
    return [];
  });
}
