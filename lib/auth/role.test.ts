import { test } from "node:test";
import assert from "node:assert/strict";
import { roleOf } from "./role";

test("roleOf: username admin dikenali sebagai admin (tanpa beda huruf/spasi)", () => {
  assert.equal(roleOf("admin"), "admin");
  assert.equal(roleOf("  ADMIN "), "admin");
  assert.equal(roleOf("Admin"), "admin");
});

test("roleOf: nama lain adalah subcont", () => {
  assert.equal(roleOf("CV DAYA ABADI BOGOR"), "subcont");
  assert.equal(roleOf("administrasi"), "subcont");
  assert.equal(roleOf("admin 2"), "subcont");
});
