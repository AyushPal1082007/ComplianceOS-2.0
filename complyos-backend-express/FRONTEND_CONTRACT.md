# Frontend Contract

## Web chat

`POST /api/chat/event` requires the existing bearer token and accepts a channel-neutral inbound event JSON object, for example:

```json
{
  "type": "TEXT",
  "text": "hello",
  "externalId": "client-generated-unique-id"
}
```

The server supplies the authenticated `userId` and `channel: "web"` and returns the existing event result shape: `status`, `messages`, `claims`, `trace`, and optional `duplicate`.

`GET /api/chat/stream` uses the same bearer token. It accepts `type`, `text`, `externalId`, `language`, or a JSON-encoded `event` query parameter. SSE emits `message` events containing one channel-neutral outbound message and one `complete` event with status/claims/trace/duplicate metadata. Do not include phone numbers, GSTINs, or other sensitive values in query strings.

Outbound message types remain `text`, `option_card`, `confirm_card`, `list`, and `file`. WhatsApp converts option/action IDs to `<cardId>::<actionId>`; clients should treat IDs as opaque.

## WhatsApp media

The webhook retains provider media IDs only long enough to download the original bytes. Audio becomes a transcript-backed text event. Images/documents are uploaded to Cloudinary and VEDA receives the resulting HTTPS URL. No media buffer or provider ID is part of the frontend response contract.

`WA_LIMITS`, Sarvam ASR formats/models, Groq behavior, and TinyFish API/rate-limit details are **not verified**. In particular, confirm WhatsApp limits and the configured utility template with their providers before production use.
