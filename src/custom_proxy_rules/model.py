from __future__ import annotations

from dataclasses import dataclass


ACTIONS = ("DIRECT", "PROXY", "REJECT")
KINDS = ("DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "IP-CIDR", "IP-CIDR6", "GEOIP")


@dataclass(frozen=True, slots=True)
class Rule:
    kind: str
    value: str
    action: str
    no_resolve: bool = False
    source: str = "unknown"
    priority: int = 0

    @property
    def key(self) -> tuple[str, str]:
        return self.kind, self.value

    def render(self) -> str:
        parts = [self.kind, self.value, self.action]
        if self.no_resolve and self.kind.startswith("IP-CIDR"):
            parts.append("no-resolve")
        return ",".join(parts)

