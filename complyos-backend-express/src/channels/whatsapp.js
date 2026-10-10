export const WA_LIMITS = Object.freeze({
  buttons: 3,
  buttonTitle: 20,
  listRows: 10,
  listTitle: 24,
  listDescription: 72,
  bodyText: 1024,
}); // TODO(verify): confirm current Meta Cloud API limits before production use.

export function encodeInteractiveId(cardId, actionId) {
  if (!cardId || !actionId || String(cardId).includes('::') || String(actionId).includes('::')) {
    throw new TypeError('Interactive card and action IDs must be non-empty and cannot contain "::"');
  }
  return `${cardId}::${actionId}`;
}

export function decodeInteractiveId(value) {
  const separator = String(value || '').indexOf('::');
  if (separator <= 0 || separator + 2 >= String(value).length) return null;
  return {
    cardId: String(value).slice(0, separator),
    actionId: String(value).slice(separator + 2),
  };
}

function inboundEvent(message, phone) {
  const base = {
    channel: 'whatsapp',
    phone,
    externalId: message.id,
  };
  if (message.type === 'text' && message.text?.body) {
    return { ...base, type: 'TEXT', text: message.text.body };
  }
  const reply = message.interactive?.button_reply || message.interactive?.list_reply;
  if (message.type === 'interactive' && reply) {
    const decoded = decodeInteractiveId(reply.id);
    if (decoded) {
      return {
        ...base,
        type: 'OPTION_TAP',
        questionId: decoded.cardId,
        optionId: decoded.actionId,
        card: { cardId: decoded.cardId, actionId: decoded.actionId },
        text: reply.title,
      };
    }
    return {
      ...base,
      type: 'MENU',
      action: reply.id,
      text: reply.title,
    };
  }
  if (message.type === 'audio' || message.type === 'voice') {
    return {
      ...base,
      type: 'VOICE',
      audio: {
        mime: message.audio?.mime_type || 'audio/ogg',
        mediaId: message.audio?.id,
      },
    };
  }
  if (message.type === 'image' || message.type === 'document') {
    const media = message[message.type] || {};
    return {
      ...base,
      type: 'DOCUMENT',
      document: {
        mime: media.mime_type || (message.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        filename: media.filename,
        providerMediaId: media.id,
      },
      text: media.caption,
    };
  }
  return null;
}

export function parseWhatsAppWebhook(body = {}) {
  const results = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        const phone = message.from;
        if (typeof phone !== 'string' || !phone) continue;
        const event = inboundEvent(message, phone);
        if (event) results.push(event);
      }
    }
  }
  return results;
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function buttonPayload(message, cardId, actions) {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: truncate(message.text, WA_LIMITS.bodyText) },
      action: {
        buttons: actions.map((action) => ({
          type: 'reply',
          reply: {
            id: encodeInteractiveId(cardId, action.id),
            title: truncate(action.label, WA_LIMITS.buttonTitle),
          },
        })),
      },
    },
  };
}

function listPayload(message, cardId, rows) {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: truncate(message.text, WA_LIMITS.bodyText) },
      action: {
        button: 'Select',
        sections: [{
          title: 'Options',
          rows: rows.slice(0, WA_LIMITS.listRows).map((row, index) => ({
            id: encodeInteractiveId(cardId, row.id || `item-${index + 1}`),
            title: truncate(row.label || row.title, WA_LIMITS.listTitle),
            ...(row.description ? { description: truncate(row.description, WA_LIMITS.listDescription) } : {}),
          })),
        }],
      },
    },
  };
}

export function renderOutbound(messages = []) {
  return messages.map((message, index) => {
    if (message.type === 'text') {
      return { type: 'text', text: { body: truncate(message.text, WA_LIMITS.bodyText) } };
    }
    if (message.type === 'option_card' || message.type === 'confirm_card') {
      const actions = message.options || message.actions || [];
      const cardId = message.id || `card-${index + 1}`;
      return actions.length <= WA_LIMITS.buttons
        ? buttonPayload(message, cardId, actions)
        : listPayload(message, cardId, actions);
    }
    if (message.type === 'list') {
      const cardId = message.id || `list-${index + 1}`;
      const rows = message.rows || (message.items || []).map((item, itemIndex) => ({
        id: item.id || `item-${itemIndex + 1}`,
        title: item.title,
        description: item.details,
      }));
      return listPayload(message, cardId, rows);
    }
    if (message.type === 'file') {
      return { type: 'text', text: { body: truncate(message.fileUrl, WA_LIMITS.bodyText) } };
    }
    throw new TypeError(`Unsupported outbound WhatsApp message type: ${message.type}`);
  });
}

export default { WA_LIMITS, decodeInteractiveId, encodeInteractiveId, parseWhatsAppWebhook, renderOutbound };
