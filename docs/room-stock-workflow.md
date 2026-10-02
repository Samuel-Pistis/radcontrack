# Shared store, room stock and daily usage

## Staff workflow

1. A collection records the date, recipient and all quantities actually received from the hospital main store. It increases store stock. It can be saved before a baseline is known; the full balance remains unconfirmed.
2. A daily pick records the room, receiving shift and picker. It subtracts from store stock and adds to room stock atomically. A film pack transfers 100 individual films. It does not count as consumption.
3. In daily entry, choose the date, shift and room. Save films printed and patients printed for under Films. Save other supplies depleted under Stock used. Film consumption subtracts individual films; contrast consumption subtracts actual bottles opened/depleted. The existing administered-millilitre clinical record is retained separately, without an extra stock deduction based on rounded volumes.
4. Remaining room stock carries forward automatically, including across dates. Changing a usage total adjusts only the difference. Concurrent stale edits are rejected.
5. Count store stock now / Count room stock now sets the actual balance at that location. Count everything physically there, including recent top-ups. It does not add the count to prior receipts. Room film counts use individual films. Counts must be dated today in Lagos. Older movements/usage included in a later count cannot deduct stock again.

The department total is store stock plus stock in all rooms. Uncounted locations keep this total unconfirmed. Staff can use known recorded top-ups without pretending the full opening balance was zero, but cannot consume more than the recorded stock without recording a count or missing pick.

New usage and film records are shared in Supabase. Earlier browser-local film/issue records stay in place and remain visible in the report; a shared film entry takes precedence only for its exact date, room and shift. Historical contrast entries are not retroactively deducted.

## Release order

Apply `supabase/migrations/20261002190000_room_stock_and_usage.sql` to project `beptsdmmbyffblwevxwh` before publishing the frontend. The script runs in a transaction and keeps existing stock movements and historical clinical data. Do not run the local test bootstrap on the live project.

Database/dashboard access is currently unavailable through the browser tool. This migration has been tested locally, but has not been applied live. Live authenticated UI verification also remains pending.

## Validation

`scripts/stock-room-tests.sql` passes against PostgreSQL 17.11 with the existing ledger and new migration. Tests cover collections with unknown opening stock, idempotent collection retries, pack-to-film conversion, transfer conservation, usage edits, no duplicate deductions, carryover across shifts, physical count replacement, atomic multi-item failure, stale edits, edits predating a count, insufficient room stock, authorized RPC access and unauthorized read/write rejection. Test movements are rolled back.

Production build, TypeScript and targeted lint are required before release. Live smoke test should use a controlled stock item and avoid creating invented operational receipts or counts.
