import test from "node:test";
import assert from "node:assert/strict";
import { createSubconverterUrl } from "../docs/converter.js";

test("subconverter URL maps Surge 4 and merges subscription inputs", () => {
  const result = createSubconverterUrl(
    "https://converter.example.com",
    ["https://one.example/sub?a=1", "https://two.example/sub"],
    "surge4",
  );
  assert.equal(result.pathname, "/sub");
  assert.equal(result.searchParams.get("target"), "surge");
  assert.equal(result.searchParams.get("ver"), "4");
  assert.equal(result.searchParams.get("url"), "https://one.example/sub?a=1|https://two.example/sub");
});

test("subconverter URL preserves an existing sub endpoint", () => {
  const result = createSubconverterUrl("https://converter.example.com/api/sub", ["vless://example"], "clash");
  assert.equal(result.pathname, "/api/sub");
  assert.equal(result.searchParams.get("target"), "clash");
});
