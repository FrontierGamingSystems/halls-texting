# California Bingo Text Monitor

Private directory and daily regional SMS feed for Frontier Gaming Systems.

The owner-only Sites deployment uses Cloudflare D1 for hall research and incoming messages. Tossable Digits supplies messages for the dedicated number. Runtime TD_API_KEY is a server-side secret; TD_NUMBER identifies the collection number.

The page retrieves new messages on opening and every minute while visible, preserving missed messages on the next visit. This version does not run an unattended background schedule. Email forwarding continues independently through Tossable Digits to texting@frontiergamingsystems.com.

Subscription evidence and enrollment status are different fields. Non-responsive signups are marked possibly inactive, not verified closed. Source research is incomplete and does not prove a statewide census. Some casino lists cover the entire property; the Fresno community program is prize bingo.

Incoming messages are deduplicated by provider ID, stored with original text and timestamp, and assigned using hall names and known hall-specific links. Shared short code 70503 alone never identifies a hall. Ambiguous messages remain unassigned for review. Display dates use America/Los_Angeles.

## Local development

Use Node22.13+ and the supplied lockfile. Set .env from .env.example, then run npm run install:ci and npm run dev. Local auth uses the starter's loopback-only sign-in simulator. Never commit .env or .sites-runtime.

Schema lives in db/schema.ts. Generate migrations with npm run db:generate. Apply local migrations through Wrangler using the generated dist/server/wrangler.json and .wrangler/state. Hosted migrations are applied by Sites.

## Validation

Real SMS retrieval and D1 insertion tested; repeated retrieval added zero duplicate messages. Anonymous API access returns401 and cross-origin sync returns403. Type checking and production build passed. Browser UI QA was not requested. WebMCP filtering is implemented but no supported contract-validation context was available.
