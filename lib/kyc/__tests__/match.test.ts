import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, jaroWinkler, matchIdentity } from "../match";

test("normalizeName — strip tildes, lowercase, preserve Ñ", () => {
  assert.equal(normalizeName("José Pérez"), "jose perez");
  assert.equal(normalizeName("PEÑA"), "peña");
  assert.equal(normalizeName("  María  Núñez  "), "maria nuñez");
  assert.equal(normalizeName(""), "");
});

test("normalizeName — trata mayúsculas Ñ y ñ correctamente", () => {
  assert.equal(normalizeName("MUÑOZ"), "muñoz");
  assert.equal(normalizeName("muñoz"), "muñoz");
});

test("jaroWinkler — strings idénticos → 1", () => {
  assert.equal(jaroWinkler("martha", "martha"), 1);
});

test("jaroWinkler — ejemplo clásico de Jaro-Winkler", () => {
  // Ejemplo del paper original de Winkler: MARTHA vs MARHTA → ~0.96
  const score = jaroWinkler("martha", "marhta");
  assert.ok(score > 0.95 && score < 0.97, `expected ~0.961, got ${score}`);
});

test("jaroWinkler — DIXON vs DICKSONX → ~0.813", () => {
  const score = jaroWinkler("dixon", "dicksonx");
  assert.ok(score > 0.78 && score < 0.84, `expected ~0.813, got ${score}`);
});

test("matchIdentity — DNI mismatch → reject duro", () => {
  const result = matchIdentity({
    form: { dni_number: "12345678", full_name: "Juan Perez Garcia" },
    ocr: {
      dni_number: "87654321",
      apellido_paterno: "PEREZ",
      apellido_materno: "GARCIA",
      prenombres: "JUAN",
    },
  });
  assert.equal(result.outcome, "reject");
  assert.equal(result.reason, "dni_mismatch");
  assert.equal(result.dni_match, false);
});

test("matchIdentity — DNI ok + nombres exactos → pass", () => {
  const result = matchIdentity({
    form: { dni_number: "70123456", full_name: "Juan Carlos Perez Garcia" },
    ocr: {
      dni_number: "70123456",
      apellido_paterno: "PEREZ",
      apellido_materno: "GARCIA",
      prenombres: "JUAN CARLOS",
    },
  });
  assert.equal(result.outcome, "pass");
  assert.equal(result.dni_match, true);
  assert.equal(result.name_match, true);
  assert.ok(result.name_score >= 0.9);
});

test("matchIdentity — nombres en orden inverso también pasan (user-friendly)", () => {
  // Usuario escribe "Perez Garcia Juan" pero OCR tiene "PEREZ GARCIA JUAN"
  const result = matchIdentity({
    form: { dni_number: "70123456", full_name: "Perez Garcia Juan" },
    ocr: {
      dni_number: "70123456",
      apellido_paterno: "PEREZ",
      apellido_materno: "GARCIA",
      prenombres: "JUAN",
    },
  });
  assert.equal(result.outcome, "pass");
});

test("matchIdentity — nombre completamente distinto → reject", () => {
  const result = matchIdentity({
    form: { dni_number: "70123456", full_name: "Mariana Chavez" },
    ocr: {
      dni_number: "70123456",
      apellido_paterno: "PEREZ",
      apellido_materno: "GARCIA",
      prenombres: "JUAN",
    },
  });
  assert.equal(result.outcome, "reject");
  assert.equal(result.reason, "name_mismatch");
});

test("matchIdentity — tildes y Ñ no afectan", () => {
  const result = matchIdentity({
    form: { dni_number: "70123456", full_name: "María Peña Núñez" },
    ocr: {
      dni_number: "70123456",
      apellido_paterno: "PEÑA",
      apellido_materno: "NUÑEZ",
      prenombres: "MARIA",
    },
  });
  assert.equal(result.outcome, "pass");
});
