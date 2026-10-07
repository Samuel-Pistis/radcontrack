# Stock units and access

The shared stock register uses the same units at every location: ml for CT, MRI and Gastrolux, individual films for both film sizes, individual pieces for CD plates and sleeves, and packs for gloves. CT and Gastrolux bottles contain 100 ml; MRI bottles contain 15 ml. Bottle equivalents are secondary information. Picks move quantities unchanged from store to room. Actual administered volume plus discarded volume reduces room stock.

The migration converts previous store bottles and film packs once, converts previous Gastrolux room records to ml, and preserves CT/MRI room ml and individual room films. It retires the gloves-pieces catalogue entry while preserving its history; it does not guess a conversion into packs. Old cached clients cannot call the old write endpoints after the migration. New draft keys prevent restoring old unit drafts.

`btradiographers@gmail.com` is the sole initial administrator, bound to its existing Auth user ID. Staff register their own email and password, confirm their email, and wait for administrator approval on the stock page. Staff can record picks, room counts and daily usage. Only the administrator can record store receipts, count store stock, correct or delete receipts, and approve or remove staff access. Changing user metadata cannot grant access.

Receipt deletion is a soft deletion. Corrections and deletions retain before/after records with the signed-in actor. Current store balances change by the quantity difference. Negative balances, stale edits and receipts covered by a later physical count are rejected. Historical balance snapshots remain labelled “Balance when recorded”.

## Deployment order

1. Retain a current database backup.
2. Apply `supabase/migrations/20261007123435_stock_units_and_permissions.sql` in the owned Supabase project. It runs as one transaction and cancels if the administrator Auth account is missing.
3. Publish the frontend from this branch immediately afterwards. Refresh existing app tabs.
4. Verify the administrator sees collection, correction and staff-approval controls. Register a staff login, approve it, and verify staff sees picks and room counts but no store-management controls.

No passwords are stored in source files or changed by this migration.

The subsequent `20261007135815_stock_editor_access.sql` update removes store-stock management from the shared `btradiographers@gmail.com` manager account. That account retains daily picks, usage and staff-login approval. Store collections, counts, receipt corrections and deletion require the separate `stock_editor` role. Apply this restriction before publishing the corresponding frontend; it does not require Honey to have registered.

After Honey creates and confirms `honey.onabanjo@bthdc.com.ng`, run `supabase/assign-honey-stock-editor.sql` to activate her stock editor access. This separate assignment cancels if the verified login is missing. Honey cannot approve staff; the shared manager can remove her access. Passwords remain private to each account.

## Verification

`scripts/stock-units-fixture.sql` plus `scripts/stock-units-tests.sql` exercise old-record conversion, preservation of existing room ml and films, unchanged CD/gloves quantities, receipt retry/correction/deletion, stale edits, same-day physical counts, insufficient balances, approved staff access, outsider/anonymous denial, clinical read/write access and metadata spoofing. Run them in a fresh local database after the three existing stock migrations and bootstrap. All test writes are rolled back.
