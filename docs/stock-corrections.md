# Correcting stock entries

Apply `supabase/migrations/20261007151437_stock_movement_corrections.sql` once in the owned Supabase SQL Editor before deploying the matching app update. It requires the stock-units and stock-editor migrations already applied. It adds correction functions, room movement versions and a private audit table; it does not change existing quantities or grant new roles.

On `/stock`, editing controls are beside each record, without horizontal scrolling.

- Collections: authorised stock editors can edit the quantity, date, recipient or reference, or delete an accidental collection. Store balance changes by the difference.
- Store counts: authorised stock editors can correct the latest count's quantity, counted-by name or reference. Later receipts and picks are preserved. Counts cannot be deleted because they establish the stock baseline.
- Daily picks: stock editors can correct any pick; approved staff can correct picks recorded under their own login. A correction updates store and receiving room by opposite amounts. Deleting a pick reverses both movements. To change the item, destination or shift, delete the incorrect pick and record the correct one.
- Room counts: stock editors can correct any latest room count; approved staff can correct their own. Later actual usage is preserved. Counts cannot be deleted.
- Actual usage: reopen the original date, room and shift on the daily entry page. Change the incorrect amounts and use **Save usage correction**. To reverse an incorrect amount, set that amount to zero; correct patient totals too when needed. Only the difference changes room stock. Original shared usage records are retained in the private audit history.

Every stock correction requires a reason. The authenticated user ID records who changed it; the displayed recipient or staff name is separate. Shared btradiographers login remains unable to edit store collections or store counts. Since a shared login has one user ID, its daily picks are all considered that account's own records.

Corrections are refused when another person has changed the record, a later physical count already covers the movement, or an affected balance would become negative. Correct affected picks/usage first, or record a physical count of what is present now. Changing older history must not alter balances that have since been physically counted.

All contrast is entered in ml. Films are entered as individual films, with 100 films per pack. No real stock was corrected during implementation: database tests use disposable records inside rolled-back transactions.

Validation: 12 frontend tests, TypeScript, targeted lint, production build, correction SQL tests and existing stock-editor SQL regression tests. Browser visual verification is unavailable because the computer-use runtime cannot initialize.
