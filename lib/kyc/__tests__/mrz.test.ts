/**
 * Tests para el parser MRZ TD1. Correr con:
 *   npx tsx --test lib/kyc/__tests__/mrz.test.ts
 * O node --test si usás tsx/register setup.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTd1, computeCheckDigit } from "../mrz";

test("computeCheckDigit — 0-filled string es 0", () => {
  assert.equal(computeCheckDigit("000000"), 0);
});

test("computeCheckDigit — known sample (ICAO 9303 ejemplo): D23145890 → 7", () => {
  // Ejemplo del standard ICAO 9303 Part 3
  // Document number "D23145890" debería dar check 7
  assert.equal(computeCheckDigit("D23145890"), 7);
});

test("parseTd1 — devuelve null si input no tiene 3 líneas", () => {
  assert.equal(parseTd1(""), null);
  assert.equal(parseTd1("una sola linea"), null);
  assert.equal(parseTd1("linea1\nlinea2"), null);
});

test("parseTd1 — parsea una MRZ TD1 bien formada (sample sintético)", () => {
  // MRZ TD1 sintética (30 chars × 3 líneas)
  // Línea 1: IDPER123456789<0<<<<<<<<<<<<<< (document IDPER, docNum 123456789, checkDigit se calcula)
  const docNum = "123456789";
  const docCheck = computeCheckDigit(docNum);
  const l1 = `IDPER${docNum}${docCheck}<<<<<<<<<<<<<<<`.slice(0, 30);

  // Línea 2: birth 900101 + check, sex M, expiry 300101 + check, nat PER, optional, finalCheck
  const birth = "900101";
  const birthCheck = computeCheckDigit(birth);
  const expiry = "300101";
  const expiryCheck = computeCheckDigit(expiry);
  // Build primero sin finalCheck (lo calculamos después)
  const l2Prefix = `${birth}${birthCheck}M${expiry}${expiryCheck}PER<<<<<<<<<<<`;
  // Composite para final check
  const composite =
    l1.slice(5, 15) +
    l1.slice(15, 30) +
    l2Prefix.slice(0, 7) +
    l2Prefix.slice(8, 15) +
    l2Prefix.slice(18, 29);
  const finalCheck = computeCheckDigit(composite);
  const l2 = `${l2Prefix}${finalCheck}`.padEnd(30, "<").slice(0, 30);

  const l3 = "PEREZ<<JUAN<CARLOS<<<<<<<<<<<<";

  const parsed = parseTd1(`${l1}\n${l2}\n${l3}`);
  assert.notEqual(parsed, null);
  if (!parsed) return;
  assert.equal(parsed.documentNumber, "123456789");
  assert.equal(parsed.sex, "M");
  assert.equal(parsed.nationality, "PER");
  assert.equal(parsed.primaryName, "PEREZ");
  assert.equal(parsed.secondaryName.startsWith("JUAN"), true);
  assert.equal(parsed.checksOk, true);
});

test("parseTd1 — detecta checks inválidos", () => {
  // Document number check incorrecto
  const l1 = "IDPER1234567899<<<<<<<<<<<<<<<"; // check 9 pero docNum 123456789 no da 9 forzosamente
  const l2 = "9001010M3001011PER<<<<<<<<<<<0";
  const l3 = "PEREZ<<JUAN<<<<<<<<<<<<<<<<<<<";
  const parsed = parseTd1(`${l1}\n${l2}\n${l3}`);
  // checksOk debería ser false porque el check del docNumber no coincide con el real
  assert.notEqual(parsed, null);
  if (parsed) {
    // Sabemos que el check real es 7, no 9 → checksOk debe ser false
    assert.equal(parsed.checksOk, false);
  }
});

test("parseTd1 — maneja sexo X (indeterminado)", () => {
  const docCheck = computeCheckDigit("987654321");
  const l1 = `IDPER987654321${docCheck}<<<<<<<<<<<<<<<`.slice(0, 30);
  const birth = "850315";
  const bC = computeCheckDigit(birth);
  const expiry = "280315";
  const eC = computeCheckDigit(expiry);
  const l2Prefix = `${birth}${bC}X${expiry}${eC}PER<<<<<<<<<<<`;
  const composite =
    l1.slice(5, 15) +
    l1.slice(15, 30) +
    l2Prefix.slice(0, 7) +
    l2Prefix.slice(8, 15) +
    l2Prefix.slice(18, 29);
  const fC = computeCheckDigit(composite);
  const l2 = `${l2Prefix}${fC}`.padEnd(30, "<").slice(0, 30);
  const l3 = "GARCIA<<ANA<<<<<<<<<<<<<<<<<<<";

  const parsed = parseTd1(`${l1}\n${l2}\n${l3}`);
  assert.notEqual(parsed, null);
  if (parsed) assert.equal(parsed.sex, "X");
});
