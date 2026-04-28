import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeChip } from "../inventory";

describe("normalizeChip", () => {
  it("strips 'Apple ' prefix case-insensitively", () => {
    assert.equal(normalizeChip("Apple M4"), "m4");
    assert.equal(normalizeChip("apple m4"), "m4");
    assert.equal(normalizeChip("APPLE M4"), "m4");
  });

  it("preserves multi-word chip names", () => {
    assert.equal(normalizeChip("Apple A16 Pro"), "a16 pro");
    assert.equal(normalizeChip("Apple M3 Pro"), "m3 pro");
    assert.equal(normalizeChip("Apple M4 Max"), "m4 max");
  });

  it("works on equipment.chip values (no prefix)", () => {
    assert.equal(normalizeChip("M4"), "m4");
    assert.equal(normalizeChip("M5"), "m5");
    assert.equal(normalizeChip("A16 Pro"), "a16 pro");
  });

  it("matches products.chip with equipment.chip via normalization", () => {
    // Test que el matching funciona en el escenario real del SQL JOIN
    assert.equal(
      normalizeChip("Apple M4"),
      normalizeChip("M4"),
      "products 'Apple M4' debe matchear con equipment 'M4'",
    );
    assert.equal(
      normalizeChip("Apple A16 Pro"),
      normalizeChip("A16 Pro"),
      "products 'Apple A16 Pro' debe matchear con equipment 'A16 Pro'",
    );
  });

  it("collapses extra whitespace", () => {
    assert.equal(normalizeChip("  Apple   M4  "), "m4");
    assert.equal(normalizeChip("Apple\tM4"), "m4");
    assert.equal(normalizeChip("Apple  A16   Pro"), "a16 pro");
  });

  it("handles null / undefined / empty safely", () => {
    assert.equal(normalizeChip(null), "");
    assert.equal(normalizeChip(undefined), "");
    assert.equal(normalizeChip(""), "");
    assert.equal(normalizeChip("   "), "");
  });

  it("does not strip 'Apple' that's NOT at the start", () => {
    // Edge case defensivo — si hubiera un chip llamado "Pro Apple Edition"
    // (no pasa hoy pero blinda contra futuros valores raros).
    assert.equal(normalizeChip("Pro Apple"), "pro apple");
  });

  it("differentiates chips that no deben matchear", () => {
    assert.notEqual(normalizeChip("Apple M4"), normalizeChip("Apple M5"));
    assert.notEqual(
      normalizeChip("Apple M4"),
      normalizeChip("Apple M4 Pro"),
      "M4 y M4 Pro son distintos",
    );
  });
});
