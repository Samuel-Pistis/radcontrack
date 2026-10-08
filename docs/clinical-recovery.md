# Recover the unfinished 7 October clinical shifts

Apply `supabase/migrations/20261008072008_legacy_clinical_carryover.sql` in the owned Supabase project's SQL editor before deploying the app change. It is one transaction: conflicting connected contrast movements or invalid remaining stock abort the whole update. Do not re-enter yesterday's usage.

The update preserves the original `daily_contrast_data` JSON and a second immutable copy in `clinical_stock_transitions`. It copies 7 October's CT (both older brands combined), Gastrolux and MRI into unfinished, editable room shift entries. Gastrolux was confirmed to belong to CT by the HOD. It establishes the morning room baseline, includes additional stock and actual saved consumption for all shifts, and leaves departmental stock unchanged. Existing film, glove, connector and CD entries are retained. Previously unrecorded wastage is labelled for review, with zero as the initial value.

Reports omit the original 7 October clinical consumption and use the editable connected copy once. The preserved reference table links to the correct editable CT or MRI date/shift. The calendar lookup uses the selected local date rather than UTC, which previously showed the preceding day's record when a midnight date was selected in Lagos.

After the SQL update and deployment, open Daily usage, choose 7 October, CT or MRI, and morning or afternoon. Saved consumption and patient figures should appear. The next day's opening comes from the movement ledger even if yesterday's shifts have not been finished. Picks add to the room stock; usage and wastage subtract. Correcting yesterday changes subsequent carry-over by the difference, without repeating its original deduction.

Validation: 35 existing/frontend tests passed, plus a report recovery regression test. TypeScript and production build passed. The isolated SQL fixture verified preserved original JSON, recovered morning/afternoon usage, unfinished shifts, CT/Gastrolux/MRI carry-over, next-day consumption and wastage, top-ups, editing yesterday, departmental stock isolation and recovery audit attribution. No live test writes were made.
