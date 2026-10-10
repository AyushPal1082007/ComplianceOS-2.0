# Backend Integration Guide

## Runtime flow

- HTTP and WhatsApp events enter `src/orchestrator/handleEvent.js`.
- The graph entrypoint is `src/graph/runGraph.js` (there is no `graph/index.js`). Consent and delete guards run before event routing.
- WhatsApp webhook payloads are parsed by `src/channels/whatsapp.js`.
- WhatsApp audio media is downloaded by provider media ID, validated as real bytes, and sent to Sarvam speech-to-text. Only a returned transcript is passed to the event graph.
- WhatsApp images and documents are downloaded by provider media ID, uploaded to Cloudinary, then passed to VEDA as the resulting HTTPS URL. VEDA continues to receive a URL; no synthetic audio/document buffers are created.
- Normalized outbound messages are rendered and sent by the WhatsApp channel adapter and service.
- SENTINEL crawl results pass through the existing approval, deduplication, daily-cap and labeling checks. Only newly stored immediate alerts proceed through `src/services/notify.js`.
- Deadline reminders are scheduled by the deadline job and use the same notification service with a reminder dedupe key.

## Notification delivery

Every reminder is stored in-app first. WhatsApp free-form text is sent only when the user's last inbound event is less than 24 hours old. Outside that window, a configured `TEMPLATE_MODE=true` and `SENTINEL_TEMPLATE_NAME` may select the operator-approved **utility** template for deadline or SENTINEL notices. Otherwise delivery remains in-app only. No marketing template path exists. Verify template approval/category in Meta before enabling template mode.

## Scheme visibility

Scheme reads require a non-placeholder `sourceUrl` and a non-placeholder `checkedBy`. Legacy read paths additionally accept HTTPS hosts under `.gov.in` and `.nic.in`, plus the official `odopup.in` domain and its subdomains. The `odopup.in` exception is intentional; do not apply a naive suffix check that rejects it. Filtering is read-time only; no deactivation SQL is run by the application.
