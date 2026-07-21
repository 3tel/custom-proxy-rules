from __future__ import annotations

import base64
import binascii
import ipaddress
import re
from urllib.parse import urlsplit

from .model import ACTIONS, KINDS, Rule


DOMAIN_RE = re.compile(r"^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]{1,63}$", re.I)
DNSMASQ_RE = re.compile(r"^server=/([^/]+)/")
ADBLOCK_DOMAIN_RE = re.compile(r"^\|\|([^/^$*|]+)(?:\^|\$|$)")


class RuleParseError(ValueError):
    pass


def normalize_domain(value: str) -> str:
    domain = value.strip().rstrip(".").lower()
    if not DOMAIN_RE.fullmatch(domain):
        raise RuleParseError(f"invalid domain: {value}")
    return domain.encode("idna").decode("ascii")


def parse_rule(line: str, action: str, source: str, priority: int) -> Rule | None:
    value = line.strip()
    if not value or value.startswith(("#", ";", "!")):
        return None

    if "," in value:
        parts = [part.strip() for part in value.split(",")]
        kind = parts[0].upper()
        if kind not in KINDS or len(parts) < 2:
            raise RuleParseError(f"unsupported rule: {line}")
        rule_action = parts[2].upper() if len(parts) >= 3 else action
        if rule_action not in ACTIONS:
            raise RuleParseError(f"invalid action: {rule_action}")
        normalized = normalize_rule_value(kind, parts[1])
        return Rule(kind, normalized, rule_action, "no-resolve" in parts[3:], source, priority)

    if value.startswith("*."):
        return Rule("DOMAIN-SUFFIX", normalize_domain(value[2:]), action, source=source, priority=priority)

    try:
        network = ipaddress.ip_network(value, strict=False)
    except ValueError:
        try:
            address = ipaddress.ip_address(value)
        except ValueError:
            return Rule("DOMAIN-SUFFIX", normalize_domain(value), action, source=source, priority=priority)
        network = ipaddress.ip_network(f"{address}/{address.max_prefixlen}")
    kind = "IP-CIDR6" if network.version == 6 else "IP-CIDR"
    return Rule(kind, str(network), action, True, source, priority)


def normalize_rule_value(kind: str, value: str) -> str:
    if kind in {"DOMAIN", "DOMAIN-SUFFIX"}:
        return normalize_domain(value)
    if kind == "DOMAIN-KEYWORD":
        return value.strip().lower()
    if kind in {"IP-CIDR", "IP-CIDR6"}:
        network = ipaddress.ip_network(value.strip(), strict=False)
        expected = 6 if kind == "IP-CIDR6" else 4
        if network.version != expected:
            raise RuleParseError(f"{kind} does not match {value}")
        return str(network)
    return value.strip().lower()


def parse_text(text: str, action: str, source: str, priority: int) -> list[Rule]:
    rules = []
    for number, line in enumerate(text.splitlines(), 1):
        try:
            rule = parse_rule(line, action, source, priority)
        except RuleParseError as exc:
            raise RuleParseError(f"{source}:{number}: {exc}") from exc
        if rule:
            rules.append(rule)
    return rules


def parse_remote(text: str, fmt: str, action: str, source: str, priority: int) -> list[Rule]:
    if fmt == "plain":
        return parse_text(text, action, source, priority)
    if fmt == "dnsmasq":
        domains = (match.group(1) for line in text.splitlines() if (match := DNSMASQ_RE.match(line)))
    elif fmt == "adblock":
        domains = _adblock_domains(text)
    elif fmt == "gfwlist":
        domains = _adblock_domains(_decode_base64(text))
    else:
        raise RuleParseError(f"unsupported source format: {fmt}")

    rules = []
    for domain in domains:
        try:
            rules.append(Rule("DOMAIN-SUFFIX", normalize_domain(domain), action, source=source, priority=priority))
        except RuleParseError:
            continue
    return rules


def _decode_base64(text: str) -> str:
    compact = "".join(text.split())
    try:
        return base64.b64decode(compact + "=" * (-len(compact) % 4)).decode("utf-8", "replace")
    except (binascii.Error, ValueError):
        raise RuleParseError("invalid base64 source") from None


def _adblock_domains(text: str):
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("!", "[", "@@")):
            continue
        match = ADBLOCK_DOMAIN_RE.match(line)
        if match:
            yield match.group(1)
            continue
        if line.startswith(("http://", "https://")):
            host = urlsplit(line).hostname
            if host:
                yield host

