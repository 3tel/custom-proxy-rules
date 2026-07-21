import test from "node:test";
import assert from "node:assert/strict";
import { appendRules, parseRemote, parseRule, resolveRules, RuleParseError } from "../scripts/rules.mjs";

test("bare domain becomes suffix rule", () => {
  assert.equal(parseRule("Example.COM", "DIRECT", "test", 100).render(), "DOMAIN-SUFFIX,example.com,DIRECT");
});

test("IPv4 CIDR is normalized", () => {
  assert.equal(parseRule("192.168.1.12/24", "DIRECT", "test", 100).render(), "IP-CIDR,192.168.1.0/24,DIRECT,no-resolve");
});

test("explicit action overrides file action", () => {
  assert.equal(parseRule("DOMAIN,api.example.com,PROXY", "DIRECT", "test", 100).action, "PROXY");
});

test("invalid domain is rejected", () => {
  assert.throws(() => parseRule("not a domain", "DIRECT", "test", 100), RuleParseError);
});

test("gfwlist base64 is parsed", () => {
  const encoded = Buffer.from("! comment\n||example.com^\n").toString("base64");
  assert.equal(parseRemote(encoded, "gfwlist", "PROXY", "gfw", 20)[0].render(), "DOMAIN-SUFFIX,example.com,PROXY");
});

test("higher priority rule wins", () => {
  const remote = parseRule("example.com", "REJECT", "remote", 30);
  const local = parseRule("example.com", "DIRECT", "local", 210);
  const result = resolveRules([remote, local]);
  assert.equal(result.rules[0].action, "DIRECT");
  assert.equal(result.conflicts[0].discardedAction, "REJECT");
});

test("appending 200,000 rules does not use the function argument stack", () => {
  const target = [];
  const additions = Array.from({ length: 200_000 }, (_, index) => index);
  appendRules(target, additions);
  assert.equal(target.length, 200_000);
  assert.equal(target.at(-1), 199_999);
});
