/**
 * Tests para duplicates — mockeamos el cliente pg con `DuplicateQueryFn`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDuplicates, type DuplicateQueryFn } from "../duplicates";

test("duplicates — mismo dni_number usado por otro user_id → flag + risk 1.0", async () => {
  const mockQuery: DuplicateQueryFn = async () => ({
    rows: [{ user_id: "other-user-123" }, { user_id: "other-user-456" }],
  });
  const r = await checkDuplicates(
    {
      correlation_id: "corr-1",
      user_id: "current-user",
      dni_number: "12345678",
    },
    mockQuery,
  );
  assert.equal(r.dni_reused_by_other_user, true);
  assert.equal(r.other_user_ids.length, 2);
  assert.equal(r.risk_score, 1.0);
});

test("duplicates — dni_number limpio (0 matches) → risk 0", async () => {
  const mockQuery: DuplicateQueryFn = async () => ({ rows: [] });
  const r = await checkDuplicates(
    {
      correlation_id: "corr-2",
      user_id: "user-x",
      dni_number: "87654321",
    },
    mockQuery,
  );
  assert.equal(r.dni_reused_by_other_user, false);
  assert.equal(r.risk_score, 0);
  assert.deepEqual(r.other_user_ids, []);
});

test("duplicates — sin dni_number → no chequea, retorna base", async () => {
  let queryCalled = 0;
  const mockQuery: DuplicateQueryFn = async () => {
    queryCalled++;
    return { rows: [] };
  };
  const r = await checkDuplicates(
    { correlation_id: "corr-3", user_id: "user", dni_number: null },
    mockQuery,
  );
  assert.equal(queryCalled, 0, "no debería llamar query sin dni_number");
  assert.equal(r.risk_score, 0);
});

test("duplicates — query falla → no flag (conservador, no bloquea verify)", async () => {
  const mockQuery: DuplicateQueryFn = async () => {
    throw new Error("DB down");
  };
  const r = await checkDuplicates(
    { correlation_id: "corr-4", user_id: "user", dni_number: "12345678" },
    mockQuery,
  );
  assert.equal(r.dni_reused_by_other_user, false);
  assert.equal(r.risk_score, 0);
});

test("duplicates — selfie similarity siempre false (stub)", async () => {
  const mockQuery: DuplicateQueryFn = async () => ({ rows: [] });
  const r = await checkDuplicates(
    { correlation_id: "corr-5", user_id: "user", dni_number: "12345678" },
    mockQuery,
  );
  assert.equal(r.selfie_similar_to_other_user, false);
  assert.deepEqual(r.similar_user_ids, []);
});
