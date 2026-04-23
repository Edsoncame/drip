import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchUif } from "../sanctions/fetch-uif";

function ndjson(objs: unknown[]): string {
  return objs.map((o) => JSON.stringify(o)).join("\n");
}

const SAMPLE_PERU_PEP = {
  id: "Q42-congreso-peru",
  schema: "Person",
  properties: {
    name: ["José García Pérez"],
    alias: ["J. García", "Pepe García"],
    birthDate: ["1965-03-12"],
    nationality: ["pe"],
    country: ["pe"],
    idNumber: ["12345678"],
    position: ["Congresista", "Ministro"],
  },
};

const SAMPLE_NON_PERU = {
  id: "Q99-argentine-pep",
  schema: "Person",
  properties: {
    name: ["Juan Rodríguez"],
    nationality: ["ar"],
    country: ["ar"],
  },
};

const SAMPLE_NON_PERSON = {
  id: "Q77-vessel",
  schema: "Vessel",
  properties: { name: ["MV Ocean"] },
};

test("fetchUif — sin URL configurada retorna []", async () => {
  const prev = process.env.KYC_SANCTIONS_UIF_URL;
  delete process.env.KYC_SANCTIONS_UIF_URL;
  try {
    const r = await fetchUif(async () => {
      throw new Error("no deberia llamar HTTP sin URL");
    });
    assert.deepEqual(r, []);
  } finally {
    if (prev !== undefined) process.env.KYC_SANCTIONS_UIF_URL = prev;
  }
});

test("fetchUif — parsea NDJSON y filtra solo peruanos", async () => {
  process.env.KYC_SANCTIONS_UIF_URL = "https://fake.test/peps.ndjson";
  const body = ndjson([SAMPLE_PERU_PEP, SAMPLE_NON_PERU, SAMPLE_NON_PERSON]);
  const records = await fetchUif(async () => body);

  assert.equal(records.length, 1);
  const [r] = records;
  assert.equal(r.source, "UIF_PE");
  assert.equal(r.source_id, "Q42-congreso-peru");
  assert.equal(r.full_name, "José García Pérez");
  assert.equal(r.doc_number, "12345678");
  assert.equal(r.list_type, "PEP");
  assert.deepEqual(r.aka_names, ["J. García", "Pepe García"]);
});

test("fetchUif — matchesPeru también acepta nationality=per y pais string", async () => {
  process.env.KYC_SANCTIONS_UIF_URL = "https://fake.test/peps.ndjson";
  const body = ndjson([
    {
      id: "Q1",
      schema: "Person",
      properties: { name: ["A"], nationality: ["PER"] },
    },
    {
      id: "Q2",
      schema: "Person",
      properties: { name: ["B"], country: ["Perú"] },
    },
  ]);
  const records = await fetchUif(async () => body);
  assert.equal(records.length, 2);
});

test("fetchUif — líneas malformadas se ignoran sin romper", async () => {
  process.env.KYC_SANCTIONS_UIF_URL = "https://fake.test/peps.ndjson";
  const body = [JSON.stringify(SAMPLE_PERU_PEP), "{{broken", ""].join("\n");
  const records = await fetchUif(async () => body);
  assert.equal(records.length, 1);
});

test("fetchUif — entity sin id o sin name se descarta", async () => {
  process.env.KYC_SANCTIONS_UIF_URL = "https://fake.test/peps.ndjson";
  const body = ndjson([
    { schema: "Person", properties: { name: ["Sin ID"], country: ["pe"] } },
    { id: "Q-empty", schema: "Person", properties: { country: ["pe"] } },
  ]);
  const records = await fetchUif(async () => body);
  assert.equal(records.length, 0);
});
