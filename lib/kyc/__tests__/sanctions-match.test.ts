import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkSanctions,
  type SanctionsQueryFn,
  type SanctionsQueryRow,
} from "../sanctions/match";

function mock(rows: SanctionsQueryRow[]): SanctionsQueryFn {
  return async () => ({ rows });
}

const ROW_BASE = {
  source: "OFAC_SDN",
  source_id: "36",
  full_name: "JUAN PEREZ GARCIA",
  aka_names: ["JOHN PEREZ", "J.P. GARCIA"] as unknown,
  doc_number: "AB12345",
  date_of_birth: "1965-03-15",
  list_type: "TERRORISM",
  metadata: { sdn_type: "Individual" } as unknown,
};

test("sanctions — doc_number exacto → hit score 1.0 + risk 0.9 (TERRORISM)", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c1",
      dni_number: "AB12345",
      full_name: "Otro Nombre",
      date_of_birth: null,
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, true);
  assert.equal(r.hits[0].match_type, "doc_exact");
  assert.equal(r.hits[0].match_score, 1.0);
  assert.ok(r.risk_score >= 0.9);
});

test("sanctions — Jaro-Winkler supera threshold → hit name_fuzzy", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c2",
      dni_number: null,
      full_name: "Juan Perez Garcia",
      date_of_birth: null,
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, true);
  assert.equal(r.hits[0].match_type, "name_fuzzy");
  assert.ok(r.hits[0].match_score >= 0.92);
});

test("sanctions — nombre distinto (< 0.92) no produce hit", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c3",
      dni_number: null,
      full_name: "Maria Rodriguez Lopez",
      date_of_birth: null,
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, false);
  assert.equal(r.hits.length, 0);
});

test("sanctions — DOB difiere >1 año descarta match fuzzy", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c4",
      dni_number: null,
      full_name: "Juan Perez Garcia",
      date_of_birth: "1990-01-01", // 25 años distinto
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, false);
});

test("sanctions — DOB dentro de tolerancia (±1 año) sí matchea", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c5",
      dni_number: null,
      full_name: "Juan Perez Garcia",
      date_of_birth: "1965-08-20",
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, true);
});

test("sanctions — alias matchea aunque full_name difiera", async () => {
  const r = await checkSanctions(
    {
      correlation_id: "c6",
      dni_number: null,
      full_name: "John Perez",
      date_of_birth: null,
    },
    mock([ROW_BASE]),
  );
  assert.equal(r.hit, true);
  assert.ok(r.hits[0].match_score >= 0.92);
});

test("sanctions — sin input no consulta DB", async () => {
  let calls = 0;
  const q: SanctionsQueryFn = async () => {
    calls++;
    return { rows: [] };
  };
  const r = await checkSanctions(
    { correlation_id: "c7", dni_number: null, full_name: null, date_of_birth: null },
    q,
  );
  assert.equal(calls, 0);
  assert.equal(r.hit, false);
});

test("sanctions — query falla → retorna base sin crashear", async () => {
  const q: SanctionsQueryFn = async () => {
    throw new Error("DB down");
  };
  const r = await checkSanctions(
    { correlation_id: "c8", dni_number: "X", full_name: "Y", date_of_birth: null },
    q,
  );
  assert.equal(r.hit, false);
  assert.equal(r.risk_score, 0);
});

test("sanctions — PEP puro rankea menor que TERRORISM", async () => {
  const pep: SanctionsQueryRow = { ...ROW_BASE, source_id: "Q1", list_type: "PEP" };
  const r = await checkSanctions(
    {
      correlation_id: "c9",
      dni_number: null,
      full_name: "Juan Perez Garcia",
      date_of_birth: null,
    },
    mock([pep]),
  );
  assert.equal(r.hit, true);
  assert.ok(r.risk_score < 0.95);
  assert.equal(r.hits[0].list_type, "PEP");
});
