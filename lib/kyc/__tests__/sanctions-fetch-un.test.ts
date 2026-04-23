import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchUn } from "../sanctions/fetch-un";

const SAMPLE_XML = `<?xml version="1.0"?>
<CONSOLIDATED_LIST>
  <INDIVIDUALS>
    <INDIVIDUAL>
      <DATAID>6908555</DATAID>
      <FIRST_NAME>JUAN</FIRST_NAME>
      <SECOND_NAME>PEREZ</SECOND_NAME>
      <THIRD_NAME>GARCIA</THIRD_NAME>
      <UN_LIST_TYPE>Al-Qaida</UN_LIST_TYPE>
      <INDIVIDUAL_ALIAS>
        <QUALITY>Low</QUALITY>
        <ALIAS_NAME>PEPE GARCIA</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ALIAS>
        <QUALITY>Low</QUALITY>
        <ALIAS_NAME>J.P.G.</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
      <NATIONALITY>
        <VALUE>Peruvian</VALUE>
      </NATIONALITY>
      <INDIVIDUAL_DATE_OF_BIRTH>
        <TYPE_OF_DATE>EXACT</TYPE_OF_DATE>
        <YEAR>1965</YEAR>
        <MONTH>3</MONTH>
        <DAY>15</DAY>
      </INDIVIDUAL_DATE_OF_BIRTH>
      <INDIVIDUAL_DOCUMENT>
        <TYPE_OF_DOCUMENT>Passport</TYPE_OF_DOCUMENT>
        <NUMBER>AB12345</NUMBER>
      </INDIVIDUAL_DOCUMENT>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>42</DATAID>
      <FIRST_NAME>SINGLE</FIRST_NAME>
      <UN_LIST_TYPE>DPRK</UN_LIST_TYPE>
    </INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <DATAID>99</DATAID>
      <FIRST_NAME>DARK CARGO LLC</FIRST_NAME>
      <UN_LIST_TYPE>ISIL</UN_LIST_TYPE>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>`;

test("fetchUn — sin URL retorna []", async () => {
  const prev = process.env.KYC_SANCTIONS_UN_URL;
  delete process.env.KYC_SANCTIONS_UN_URL;
  try {
    const r = await fetchUn(async () => {
      throw new Error("nope");
    });
    assert.deepEqual(r, []);
  } finally {
    if (prev !== undefined) process.env.KYC_SANCTIONS_UN_URL = prev;
  }
});

test("fetchUn — parsea individuals + entities y clasifica", async () => {
  process.env.KYC_SANCTIONS_UN_URL = "https://fake/un.xml";
  const r = await fetchUn(async () => SAMPLE_XML);
  assert.equal(r.length, 3);

  const juan = r.find((x) => x.source_id === "IND-6908555");
  assert.ok(juan);
  assert.equal(juan.full_name, "JUAN PEREZ GARCIA");
  assert.equal(juan.date_of_birth, "1965-03-15");
  assert.equal(juan.doc_type, "Passport");
  assert.equal(juan.nationality, "Peruvian");
  assert.equal(juan.list_type, "TERRORISM");
  assert.deepEqual(juan.aka_names, ["PEPE GARCIA", "J.P.G."]);

  const single = r.find((x) => x.source_id === "IND-42");
  assert.ok(single);
  assert.equal(single.full_name, "SINGLE");
  assert.equal(single.list_type, "SANCTION"); // DPRK no matchea TERRORISM

  const entity = r.find((x) => x.source_id === "ENT-99");
  assert.ok(entity);
  assert.equal(entity.full_name, "DARK CARGO LLC");
  assert.equal(entity.list_type, "TERRORISM");
  assert.equal((entity.metadata as { un_schema: string }).un_schema, "entity");
});

test("fetchUn — XML malformado devuelve []", async () => {
  process.env.KYC_SANCTIONS_UN_URL = "https://fake/un.xml";
  const r = await fetchUn(async () => "<nope>");
  assert.deepEqual(r, []);
});
