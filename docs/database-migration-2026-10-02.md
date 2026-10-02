# RadConTrack database migration

Source: Lovable Cloud project `voqpuvsyrfbmpdvlasfp`.
Destination: owned Supabase project `beptsdmmbyffblwevxwh`, RadConTrack in Mango.

The export `radcontrack_261002.backup.zip` was read with PostgreSQL 17.11 restore tools. Application tables and the existing auth user/identity were restored. Managed Supabase system schemas, active sessions, and platform configuration were not copied over the destination's system tables.

## Verification

- Daily records: 237, 2026-02-04 through 2026-10-01.
- Usage-log records: 0.
- Existing auth users and identities: 1 each.
- Record ID MD5: `b20a4edc12cb750fa1e4da575c3d6bf3`.
- Full record content MD5: `852366ed8f9d384199d71bf3e368d9d6`.
- Both checksums match the source export.
- Existing app login works on localhost. The restored 1 October daily entry displays 960 ml total usage.

Shared stock tests execute inside a rolled-back transaction. They cover known opening balances (including zero), receipts, picks, ledger history, insufficient stock, atomic failure of a multi-item batch, and unauthorized read/write access. No test stock is retained.

Local app settings use the owned database and its publishable key. The stock register requires a physical opening count before receipts or picks. Old film and inventory records held in browser local storage are outside the database export.

## Pending live switch

Verify Netlify's build environment variables, deploy the reviewed app, and verify the live login, historical entries, and shared stock screen. Lovable Cloud remains available during this transition. Do not disable or remove it before live verification and retention of the source backup.

Database exports and generated restore SQL are private and ignored by Git under `migration-backup/`.
