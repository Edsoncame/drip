import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchOfac } from "../sanctions/fetch-ofac";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sdnList>
  <publshInformation>
    <Publish_Date>01/01/2026</Publish_Date>
  </publshInformation>
  <sdnEntry>
    <uid>36</uid>
    <firstName>JUAN</firstName>
    <lastName>PEREZ GARCIA</lastName>
    <sdnType>Individual</sdnType>
    <programList>
      <program>SDGT</program>
      <program>SDNTK</program>
    </programList>
    <akaList>
      <aka>
        <uid>1</uid>
        <type>a.k.a.</type>
        <firstName>JOHN</firstName>
        <lastName>PEREZ</lastName>
      </aka>
      <aka>
        <uid>2</uid>
        <type>a.k.a.</type>
        <firstName>J.P.</firstName>
        <lastName />
      </aka>
    </akaList>
    <nationalityList>
      <nationality>
        <uid>1</uid>
        <country>Peru</country>
      </nationality>
    </nationalityList>
    <dateOfBirthList>
      <dateOfBirthItem>
        <uid>1</uid>
        <dateOfBirth>15 Mar 1965</dateOfBirth>
      </dateOfBirthItem>
    </dateOfBirthList>
    <idList>
      <id>
        <uid>1</uid>
        <idType>Passport</idType>
        <idNumber>AB123456</idNumber>
      </id>
    </idList>
  </sdnEntry>
  <sdnEntry>
    <uid>100</uid>
    <firstName>OCEAN</firstName>
    <lastName>SHIPPING &amp; CO</lastName>
    <sdnType>Entity</sdnType>
    <programList>
      <program>IRAN</program>
    </programList>
  </sdnEntry>
</sdnList>`;

test("fetchOfac — sin URL retorna []", async () => {
  const prev = process.env.KYC_SANCTIONS_OFAC_URL;
  delete process.env.KYC_SANCTIONS_OFAC_URL;
  try {
    const r = await fetchOfac(async () => {
      throw new Error("should not fetch");
    });
    assert.deepEqual(r, []);
  } finally {
    if (prev !== undefined) process.env.KYC_SANCTIONS_OFAC_URL = prev;
  }
});

test("fetchOfac — parsea dos entries y clasifica correctamente", async () => {
  process.env.KYC_SANCTIONS_OFAC_URL = "https://fake/ofac.xml";
  const r = await fetchOfac(async () => SAMPLE_XML);
  assert.equal(r.length, 2);

  const [juan, ocean] = r;
  assert.equal(juan.full_name, "JUAN PEREZ GARCIA");
  assert.equal(juan.source_id, "36");
  assert.equal(juan.doc_type, "Passport");
  assert.equal(juan.doc_number, "AB123456");
  assert.equal(juan.nationality, "Peru");
  assert.equal(juan.date_of_birth, "15 Mar 1965");
  assert.equal(juan.list_type, "TERRORISM"); // SDGT first in classify
  assert.deepEqual(juan.aka_names, ["JOHN PEREZ", "J.P."]);

  assert.equal(ocean.full_name, "OCEAN SHIPPING & CO");
  assert.equal(ocean.list_type, "SANCTION");
});

test("fetchOfac — entry sin nombre se descarta", async () => {
  process.env.KYC_SANCTIONS_OFAC_URL = "https://fake/ofac.xml";
  const xml = `<sdnList><sdnEntry><uid>999</uid><sdnType>Individual</sdnType></sdnEntry></sdnList>`;
  const r = await fetchOfac(async () => xml);
  assert.equal(r.length, 0);
});

test("fetchOfac — XML roto no crashea, devuelve lo parseable", async () => {
  process.env.KYC_SANCTIONS_OFAC_URL = "https://fake/ofac.xml";
  const r = await fetchOfac(async () => "<not really xml>");
  assert.deepEqual(r, []);
});
