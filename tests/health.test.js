import test from "node:test";
import assert from "node:assert/strict";
test("health endpoint contract is present", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(source, /api\/health/);
  assert.match(source, /api\/admin\/browser\/screenshot/);
});