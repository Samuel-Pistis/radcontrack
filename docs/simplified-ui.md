# Simplified daily and stock workflows

The home page is now **Daily usage**: select date, shift and room, then enter **Films printed** or **Contrast and supplies**. Film entries retain patients printed for and separate sizes; contrast continues to use actual administered/discarded ml. Save and reload behaviour uses the existing shared usage functions. Drafts still restore, and unsaved changes disable date/shift/room/category switching.

**Stock** opens Receive stock for an authorised stock editor, and Pick for a room for other approved users. Stock task navigation separates:

- Pick for a room: transfer items from the department store into a room.
- Receive stock: enter actual collections and recipient names; authorised editors only.
- Count what is left: store or room physical counts. Store counts remain editor-only.
- Balances: store, room and department totals, with unconfirmed locations marked.
- Movement history: paginated store/room records with corrections beside entries.
- Staff access: shown only to the administrator.

The clinical contrast entry remains at `/clinical`, with its original data and calculations. It is separate from daily stock deductions. Reports retain clinical results, shared film/supply usage, and stock picks. Older browser-only stock records remain accessible from Reports. Existing `/stock` links continue to work through a role-based redirect.

**Audit history** is available to stock editors and the administrator, through a server-authorised read endpoint. It shows the account, timestamp in Lagos time, reason and changed values. It includes the older receipt audit table as well as current stock/usage correction history. Ordinary staff cannot call the endpoint or read the private tables. Dates and pages are bounded by the database.

## Deployment

Requires the prior stock movement correction migration from PR #10. Apply `supabase/migrations/20261007154717_audit_history_view.sql` once in the owned Supabase SQL Editor, then deploy the app. The migration adds an audit read endpoint only; it does not change quantities or grant new membership roles. The daily/stock screens continue working if the audit endpoint has not yet been applied, and the audit page explains the missing update.

No live stock records were changed. Database checks use isolated fixtures and rollback. Browser visual inspection remains unavailable because the computer-use runtime cannot initialise, so local visual review is still needed.

Validation passed: 20 frontend tests covering the daily selection flow, unsaved changes, role-based forms, count/pick corrections and audit display; TypeScript; lint of changed code; production build; and PostgreSQL audit permissions, date filtering, pagination and legacy history checks.
