# Supabase deployment

The application supports a dedicated Supabase project as its primary hall and message database. Until both Supabase environment variables are configured, the existing D1 database continues serving the site.

1. Create the separate Bingo Text Monitor project. Keep Data API enabled; disable automatic grants to new tables and enable automatic RLS.
2. Run `migrations/202609110001_bingo_monitor.sql` in its SQL Editor, or apply it through the Supabase CLI. The migration only creates tables prefixed `bingo_`.
3. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-side runtime values. Mark the service key secret. Never expose it in browser code or GitHub source.
4. Trigger the authenticated `POST /api/monitor` once. The server imports the current hall directory and retrieves all incoming provider messages from September 11, 2026 onward. Existing IDs are deduplicated. Confirm a subsequent sync adds zero duplicates before retiring any old collection storage.
5. `GET /api/monitor?day=YYYY-MM-DD` and `?hall=ID` read Supabase once configured. The D1 implementation remains available while the migration is pending. Credentials are not interchangeable between the two backends.

Public users can read hall details and promotional messages. Signup and service replies remain stored but are excluded by both public RLS policies and inbox queries. Public users cannot write hall/message records, invoke ingestion, or read sync state and link-cache tables. SMS sending is not implemented in the public application.

Run `npm test` to validate the migration against an embedded PostgreSQL engine, including anonymous permission failures, duplicate ingestion, shared hall counts and operational-message filtering. This does not replace a live project smoke test after connection.

Reference: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [database migrations](https://supabase.com/docs/guides/local-development/database-migrations).
