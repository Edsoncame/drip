# AUDIT NOTES — issues found but not fixed

> Audit date: 2026-04-22 · Branch `audit/2026-04-22` · Non-trivial issues
> deferred for dedicated review because the fix could change semantics.

## P1 — setState inside useEffect body (React Hooks rule)

The React Compiler flags these as performance antipatterns (cascading
renders). Each requires reading the effect's intent before fixing — some
are legitimate derived-state patches, others are real bugs.

**Fix strategy per case:**
- Derived state → replace with `useMemo` or compute inline
- Cached data → `useSyncExternalStore` or move to parent
- One-shot init → `useState(() => initValue)` lazy initializer
- External sync → wrap in callback form or keep with justification comment

### Locations

| File | Line | Context |
|---|---|---|
| `lib/use-products.ts` | 29 | `useEffect` hydrates `products` from module-level cache. Fix: lazy initializer. |
| `components/PhoneInput.tsx` | 103 | Probably syncing input value from prop; fix: derive inline or `useMemo`. |
| `components/checkout/AddressAutocomplete.tsx` | 24, 66 | Two setStates in effect — likely syncing Google Maps state. Complex, needs care. |
| `app/admin/precios/PricingTable.tsx` | 58 | Sync from props — fix: derive inline. |
| `app/admin/vault/VaultClient.tsx` | 242 | Sync from query result; may be legit loading pattern. |
| `app/checkout/success/page.tsx` | 24 | Probably `setMounted(true)` pattern for SSR → lazy useState. |
| `app/checkout/page.tsx` | 2137 | Large client component; needs dedicated review. |

**Criticality:** no runtime crash — only performance (cascading renders).
Safe to defer; prioritize based on which pages you see as "slow" in
production telemetry.

## P2 — ESLint disable comments that are unused

~4 warnings about `Unused eslint-disable directive`. Every one means the
underlying rule now passes, but the disable was left in. Safe to remove,
just hunt and kill:

```
grep -rn "eslint-disable-next-line" --include='*.ts' --include='*.tsx' | head
```

## P2 — Unused variables in scripts/ (warnings only)

Scripts in `scripts/*.mjs` have:
- `scripts/generate-admin-tutorial.mjs` — `GREEN`, `footer` unused
- `scripts/webhook-replay.mjs` — `POST`, `sendEmail` unused

These were leftovers of iteration; safe to remove.

## P3 — Unused state setters in AgentsScene.tsx

- `setUploadingSelfie`, `setPendingImages`, `setMusicEnabled`, `setInvoiceFile`

Declared but never called. Some probably left over from features that were
removed or never wired. Needs a read to confirm before removing — they may
be intentionally present for future use.

## P3 — Unused imports/variables

- `scripts/generate-admin-tutorial.mjs:15` `'GREEN' is assigned a value but never used`
- `scripts/webhook-replay.mjs:42,54` — POST + sendEmail never used

## P3 — react-hooks/exhaustive-deps warnings

3 warnings about missing deps in `useCallback`:
- AgentsScene.tsx — `input`, `ensureAudio`, `agentMap`

These can be legit false positives (callbacks capturing stable closures)
or real stale-closure bugs. Each needs reading the callback to decide.

## P3 — Ref accessed during render

Already mitigated with eslint-disable in `components/kyc/DniCaptureGuided.tsx:403`.
Real fix would convert `capturedRef` to `useState`, but the ref is
referenced in 7+ places across async callbacks. Defer.

## P3 — Untracked artifact files

Under `docs/google-ads-api-design-doc.{docx,html,md,pdf}` — generated
during the Google Ads API application process. They are NOT under
version control (matching `.gitignore` via `.docx`/`.pdf`/`.html`/`.md`
inclusion or explicit ignore). Decide:
- Keep as reference → commit the `.md` at least
- Ephemeral → add to `.gitignore` explicitly

## Tests — missing coverage

The `test` script only runs `lib/kyc/__tests__/*.test.ts`. There is
no coverage for:
- `lib/stripe.ts`
- `lib/email.ts` templates
- `lib/agents/*` runtime
- API routes (e.g. `/api/webhooks/stripe`)

This is scope for a follow-up work stream, not this audit.

## CI

No GitHub Actions workflow detected (`.github/workflows/` empty/missing).
Lint + typecheck + tests currently only run locally or via Vercel build.
Recommendation: add a `.github/workflows/ci.yml` that runs
`npm ci && npm run lint && npx tsc --noEmit && npm test` on every PR.
Out of scope for this audit (destructive config addition).
