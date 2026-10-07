# Connected room shift entry

Deploy the SQL migration `20261007220349_unified_shift_workflow.sql` in the owned Supabase project before deploying this app version. It builds on the existing units, correction/audit and Mammography migrations. It does not seed live counts, convert old usage again, or reset inventory.

## Staff flow

1. An authorised stock editor records collections from the main store into department stock.
2. Staff pick stock into a named room and shift. Further top-ups use the same flow. These are transfers, not consumption.
3. Daily usage selects date, room and shift once. Contrast has actual ml for patients, patient count, and wastage ml. Each film size has films printed and patients printed for. Other consumables exclude contrasts, films, A4 paper and retired glove pieces.
4. Save progress updates the shared usage and room balance in one database transaction. Corrections deduct or restore only the difference. Patient use remains separate from waste in reports.
5. Finish shift requires each routine item to be reviewed, including explicit zero use, and actual remaining stock to be confirmed. Differences and unconfirmed opening stock require an explanation. Physical confirmations do not silently replace stock; an authorised physical count remains the adjustment mechanism.

Room balances carry forward through the effective movement ledger. The display separates carried-over stock, pickups, physical count adjustments and remaining stock. A count from an older client without a shift leaves that day's intraday balance unconfirmed; subsequent days carry its effective balance. New room counts ask for a shift.

Any new room movement or correction reopens affected finished shifts. A movement fingerprint prevents finishing against a stale balance. Drafts retain entered amounts, but clear review confirmations when stock changes.

## Historical data

Earlier clinical records remain read-only in the archive. New connected contrast contributes to the same daily/weekly/monthly clinical reports, without waste inflating patient administration. The database rejects adding connected contrast to a shift with existing legacy clinical consumption, to avoid duplicate reporting. Such an overlap needs a separate, deliberate historical reconciliation; this release does not guess which room an old combined clinical total belongs to.

Earlier film patient totals remain available. Size-specific patient counts are shown as unknown until supplied; an overall count is never divided or copied into both sizes automatically. Combined new size counts may overlap and are not described as unique patients.

Current departmental stock, including glove packs, appears separately from period usage. A physical count is not reported as consumption. A4 paper stays in department stock and historic usage, but is excluded from the routine shift checklist.

## Validation

- Isolated PostgreSQL tests cover consumption + waste, next-shift/next-day carryover, multiple top-ups, correction deltas, stale saves, finish validation, reopening and film sizes.
- Existing correction, stock-editor permission and audit tests pass on the new schema.
- UI tests cover single-entry saving, remaining-stock preview, missing reviews and navigation protection.
- No test stock entries were written to the live project. Live browser verification is still required after applying the migration; the browser automation runtime is unavailable in this session.
