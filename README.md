# California Bingo Hall and Text Monitor

Shared hall cards, published schedules, advance-sales links and regional promotional SMS history for Frontier Gaming Systems. Source: [FrontierGamingSystems/halls-texting](https://github.com/FrontierGamingSystems/halls-texting). Database: the dedicated **Bingo Halls and Texting** Supabase project.

Cards sort by the latest promotional message and open **View details** with website, exact address when verified, bingo weekdays and times, texting/sales platforms, advance purchase links, evidence sources, and message history. Signup confirmations and operational replies are retained privately but excluded from counts, previews, history and public database reads. Promotional messages remain visible when they contain STOP footers.

The September 11 research pass added 33 listings to the previous 296. It manually updated 81 existing records, recorded 93 published schedules, and checked 107 city-search entries. Automated rescanning attempted all 296 original records and fetched 833 pages, including likely signup, calendar and sales pages. Detailed source evidence and caveats are in research/; excerpts from the automated scan are candidates, not verified claims. The 329 listings include historical, paused, community and event-only leads and are not a complete statewide census.

Chumash, Agua Caliente, Fantasy Springs and Table Mountain confirmed enrollment after the requested replies were completed, bringing the confirmed hall count to 19. These casino-wide lists are not bingo-exclusive. Table Mountain confirmed both EARN and JACKPOT alerts; its optional email signup was not requested. Confirmed SMS enrollment does not prove a venue currently operates: Industry's published suspension is recorded separately.

## Runtime and database

The application runs on Cloudflare Workers via Sites/vinext. Supabase is its configured primary database; the prior D1 implementation remains as a migration fallback when Supabase configuration is absent. Tables store hall records, original incoming messages, many-to-many hall associations, sync state and campaign-link mappings. Server-only credentials are never bundled for the browser.

The owner can collect new messages by opening or refreshing the app. Other visitors read collected promotions without signing in. The page refreshes every minute while visible; an unattended background collection schedule is not configured. Tossable Digits email forwarding runs independently. The public app has no SMS sending endpoint.

The parser uses hall names, verified dedicated numbers, audited enrollment sequences and hall-specific campaign links. A shared shortcode or platform domain alone never identifies a hall. Unresolved links receive bounded server-side reads; uncertain or image-only pages remain for review. Shared Vanguard messages appear under both locations only when no single location is specified. Times are shown in America/Los_Angeles.

## Development

Use Node 22.13+ and the supplied lockfile. Copy .env.example to .env, configure server credentials, run npm run install:ci, then npm run dev. Do not commit .env or .sites-runtime.

npm test validates PostgreSQL ingestion, duplicate handling, public read-only permissions, shared-location counts and operational-message filtering. npx tsc --noEmit and npm run build check the application. The GitHub validation workflow runs these checks on pushes and pull requests.

See [Supabase deployment](supabase/README.md) for schema and connection setup. Runtime secrets are TD_API_KEY, TD_NUMBER, BINGO_SYNC_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY (the existing secret API key is accepted under this name). Keep all credentials out of source control. Hosted Sites publication uses the existing .openai/hosting.json project; never create a replacement Site for this checkout.

Validation performed locally and against the live Supabase project: 329 hall rows imported, 42 incoming messages retained, 9 promotions publicly readable, no unassigned promotions, and anonymous ingestion/private-state requests denied. The database tests also verify repeated ingestion adds no duplicates. Browser visual QA was not requested; WebMCP contract validation was unavailable.
