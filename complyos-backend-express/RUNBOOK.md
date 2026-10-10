# Operations Runbook

## Start the Express backend

Run `npm start` from `complyos-backend-express`. The server connects Prisma and starts the SENTINEL crawl worker and deadline reminder worker. The graph entrypoint is `src/graph/runGraph.js`, not `src/graph/index.js`.

## WhatsApp media setup

Set the WhatsApp provider credentials and configure Cloudinary before accepting media in production. Provider media downloads require the webhook message's `audio.mediaId` or `document.providerMediaId`. A missing media ID, failed download, empty/oversized payload, failed transcription/upload, or non-HTTPS Cloudinary URL is an explicit processing failure; no fake buffer or demo transcript is passed to VEDA/ARIA.

Audio requires a configured Sarvam API key. Demo-fallback transcripts are rejected for inbound WhatsApp audio. Documents flow as provider download -> Cloudinary upload -> HTTPS URL -> VEDA.

## Notifications and scheduled jobs

Deadline reminder and SENTINEL immediate-delivery notifications use `src/services/notify.js`. Free-form WhatsApp sends require an inbound event in the prior 24 hours. Outside that window, configure `TEMPLATE_MODE=true` and `SENTINEL_TEMPLATE_NAME` only after an operator verifies that the named Meta template is approved and categorized as utility. Without both settings the notification remains in-app only. Never use marketing templates for reminders or regulatory alerts.

SENTINEL sends at most one immediate alert per user per day; further qualifying alerts are queued to the digest path. Simulated alerts must retain the `Simulated alert` label. Deadline reminders use a persisted dedupe key so repeated worker runs do not create or send the same reminder twice.

## Scheme verification and optional local SQL

Application reads hide schemes without verified `sourceUrl` and `checkedBy`. Legacy scheme paths require HTTPS `.gov.in` or `.nic.in` hosts, with an explicit `odopup.in` exception. No SQL is run by the application. Review this preview locally before considering deactivation:

```sql
SELECT
  id,
  name,
  source_url,
  checked_by,
  CASE
    WHEN NULLIF(BTRIM(source_url), '') IS NULL
      OR source_url ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
      THEN 'missing or placeholder source_url'
    WHEN NULLIF(BTRIM(checked_by), '') IS NULL
      OR checked_by ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
      THEN 'missing or placeholder checked_by'
    WHEN source_url !~* '^https://([a-z0-9-]+[.])*(gov[.]in|nic[.]in|odopup[.]in)([/?#]|$)'
      THEN 'source is not an allowed official host'
  END AS deactivation_reason
FROM schemes
WHERE is_active = TRUE
  AND (
    NULLIF(BTRIM(source_url), '') IS NULL
    OR source_url ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
    OR NULLIF(BTRIM(checked_by), '') IS NULL
    OR checked_by ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
    OR source_url !~* '^https://([a-z0-9-]+[.])*(gov[.]in|nic[.]in|odopup[.]in)([/?#]|$)'
  )
ORDER BY name, id;
```

If the preview is reviewed and deactivation is explicitly desired, the corresponding non-destructive-to-data (soft-disable) statement is:

```sql
UPDATE schemes
SET is_active = FALSE
WHERE is_active = TRUE
  AND (
    NULLIF(BTRIM(source_url), '') IS NULL
    OR source_url ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
    OR NULLIF(BTRIM(checked_by), '') IS NULL
    OR checked_by ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
    OR source_url !~* '^https://([a-z0-9-]+[.])*(gov[.]in|nic[.]in|odopup[.]in)([/?#]|$)'
  );
```

This is SQL for local review only; it was not executed. Keep `odopup.in` explicitly allowed because it does not end in `.gov.in` or `.nic.in`.

## Verification

- Run all backend tests: `npm run test:all`
- Syntax-check the server: `node --check src/server.js`
- Confirm no SQL logging beyond warn/error in `src/db.js`.

Provider-specific `WA_LIMITS`, Sarvam, Groq, and TinyFish details are **not verified**. Confirm current limits, supported formats/models, API contracts, and rate limits with the providers before production use.
