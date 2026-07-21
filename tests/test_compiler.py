import json
import tempfile
import unittest
from pathlib import Path

from custom_proxy_rules.compiler import Compiler
from custom_proxy_rules.model import Rule


class CompilerTests(unittest.TestCase):
    def test_higher_priority_rule_wins(self):
        compiler = Compiler(Path("."))
        public = Rule("DOMAIN-SUFFIX", "example.com", "REJECT", source="remote", priority=30)
        private = Rule("DOMAIN-SUFFIX", "example.com", "DIRECT", source="private", priority=210)
        resolved = compiler._resolve([public, private])
        self.assertEqual(resolved[public.key].action, "DIRECT")
        self.assertEqual(compiler.conflicts[0].discarded_action, "REJECT")

    def test_offline_build_writes_three_modules(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "rules/local").mkdir(parents=True)
            for action in ("direct", "proxy", "reject"):
                (root / f"rules/local/{action}.txt").write_text("", encoding="utf-8")
            (root / "rules/local/direct.txt").write_text(
                "router.home.arpa\n10.0.0.0/8\n", encoding="utf-8"
            )

            report = Compiler(root).build(fetch=False)

            self.assertEqual(report["counts"]["DIRECT"], 2)
            module = (root / "dist/shadowrocket/direct.module").read_text(encoding="utf-8")
            self.assertIn("DOMAIN-SUFFIX,router.home.arpa,DIRECT", module)
            self.assertIn("IP-CIDR,10.0.0.0/8,DIRECT,no-resolve", module)
            report_file = json.loads((root / "build-report.json").read_text())
            self.assertEqual(report_file["conflict_count"], 0)


if __name__ == "__main__":
    unittest.main()
