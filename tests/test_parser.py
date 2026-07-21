import base64
import unittest

from custom_proxy_rules.parser import RuleParseError, parse_remote, parse_rule


class ParserTests(unittest.TestCase):
    def test_bare_domain_becomes_suffix_rule(self):
        rule = parse_rule("Example.COM", "DIRECT", "test", 100)
        self.assertEqual(rule.render(), "DOMAIN-SUFFIX,example.com,DIRECT")

    def test_cidr_is_normalized_and_no_resolve(self):
        rule = parse_rule("192.168.1.12/24", "DIRECT", "test", 100)
        self.assertEqual(rule.render(), "IP-CIDR,192.168.1.0/24,DIRECT,no-resolve")

    def test_explicit_rule_can_override_file_action(self):
        rule = parse_rule("DOMAIN,api.example.com,PROXY", "DIRECT", "test", 100)
        self.assertEqual(rule.action, "PROXY")

    def test_invalid_domain_reports_error(self):
        with self.assertRaises(RuleParseError):
            parse_rule("not a domain", "DIRECT", "test", 100)

    def test_gfwlist_base64_parser(self):
        encoded = base64.b64encode(b"! comment\n||example.com^\n").decode()
        rules = parse_remote(encoded, "gfwlist", "PROXY", "gfw", 20)
        self.assertEqual([rule.render() for rule in rules], ["DOMAIN-SUFFIX,example.com,PROXY"])


if __name__ == "__main__":
    unittest.main()
