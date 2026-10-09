'use strict';
/**
 * ComplianceOS — ARIA Agent (Adaptive Response and Intake Agent)
 * Handles conversational compliance queries using Groq API (llama3-70b-8192)
 * Hindi/Hinglish slot-filling into Business Profile JSON
 * Per PDF Section 7: "Profile completes in <5 turns on 5 test speakers"
 */
import Groq from 'groq-sdk';
import config from '../config.js';
import logger from '../logger.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ── Slot definitions for Business Profile ─────────────────────────────────────

const PROFILE_SLOTS = [
  { key: 'businessName',   label: 'business ka naam (आपके व्यवसाय का नाम)',   type: 'string',  required: true  },
  { key: 'businessType',   label: 'business ka prakar (trader/manufacturer/service)',     type: 'enum',    required: true  },
  { key: 'sector',         label: 'sector (jaise textile, food, electronics)',           type: 'string',  required: false },
  { key: 'state',          label: 'rajya (state, e.g. Uttar Pradesh)',                  type: 'string',  required: true  },
  { key: 'district',       label: 'jila (district)',                                    type: 'string',  required: false },
  { key: 'gstin',          label: 'GSTIN (15-digit GST number, if registered)',         type: 'gstin',   required: false },
  { key: 'pan',            label: 'PAN number',                                         type: 'pan',     required: false },
  { key: 'udyamNumber',    label: 'Udyam registration number (if any)',                 type: 'string',  required: false },
  { key: 'annualTurnover', label: 'saalik karobaar (annual turnover in lakhs INR)',     type: 'number',  required: true  },
  { key: 'employeeCount',  label: 'karamchari sankhya (number of employees)',           type: 'number',  required: false },
  { key: 'isWomenLed',     label: 'kya aapka business mahila netritva mein hai? (yes/no)', type: 'boolean', required: false },
];

const ARIA_SYSTEM_PROMPT = `You are ARIA — ComplianceOS ka Hindi-English compliance assistant. 
Aap ek friendly aur professional AI hain jo Hindi-speaking MSME owners ki madad karte hain.

Aapka kaam hai: ek baar mein ek question poochkar Business Profile complete karna.

RULES:
1. Hamesha Hindi mein respond karein (Hinglish chalega — Hindi + English mix).
2. Ek baar mein SIRF EK slot poochein.
3. User ke answer ko extract karein aur JSON mein daalein.
4. Agar user ka answer incomplete ya unclear ho, dobara poochein.
5. Har response ke saath updated slot JSON return karein.
6. Jab saare required slots fill ho jaayein, profile_complete: true karein.

Response format (ALWAYS return this JSON):
{
  "message": "Hindi/Hinglish message to user",
  "extracted": { "slot_key": "extracted_value" },
  "next_slot": "next_slot_key_to_ask or null",
  "profile_complete": false,
  "confidence": 0.95
}

Compliance context:
- GSTIN: 15-digit format, starts with 2-digit state code
- Udyam: format UDYAM-XX-00-XXXXXXX
- Annual turnover in lakhs INR determines GST late fee bracket:
  - Up to ₹1.5 Cr: ₹50/day, max ₹2,000 per return
  - ₹1.5–5 Cr: ₹50/day, max ₹5,000 per return
  - Above ₹5 Cr: ₹50/day, max ₹10,000 per return
- Women-led MSMEs get special scheme benefits and discounts.`;

// ── Validators ────────────────────────────────────────────────────────────────

const validators = {
  gstin: (v) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v?.toUpperCase()),
  pan:   (v) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v?.toUpperCase()),
  udyam: (v) => /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(v?.toUpperCase()),
};

// ── Get missing required slots ────────────────────────────────────────────────

function getMissingSlots(filledSlots) {
  return PROFILE_SLOTS.filter(
    (s) => s.required && (filledSlots[s.key] === undefined || filledSlots[s.key] === null)
  );
}

function getNextSlot(filledSlots) {
  return PROFILE_SLOTS.find(
    (s) => filledSlots[s.key] === undefined || filledSlots[s.key] === null
  ) || null;
}

// ── Core ARIA chat function ───────────────────────────────────────────────────

async function ariaChat(messages, currentSlots = {}) {
  const nextSlot = getNextSlot(currentSlots);
  const missingRequired = getMissingSlots(currentSlots);

  const contextMessage = `
Current filled slots: ${JSON.stringify(currentSlots)}
Next slot to ask: ${nextSlot ? nextSlot.key : 'none (profile complete)'}
Next slot label: ${nextSlot ? nextSlot.label : 'N/A'}
Required slots still missing: ${missingRequired.map(s => s.key).join(', ') || 'none'}
Profile complete: ${missingRequired.length === 0}
`;

  const response = await groq.chat.completions.create({
    model: config.groq.model,
    messages: [
      { role: 'system', content: ARIA_SYSTEM_PROMPT + '\n\nCONTEXT:\n' + contextMessage },
      ...messages,
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(raw);
    
    // Validate extracted slot values against type rules
    if (parsed.extracted) {
      for (const [key, val] of Object.entries(parsed.extracted)) {
        const slotDef = PROFILE_SLOTS.find(s => s.key === key);
        if (slotDef && validators[slotDef.type]) {
          if (!validators[slotDef.type](val)) {
            parsed.extracted[key] = null; // reject invalid value
            parsed.message += '\n\n(Format galat lag raha hai — please dobara check karein)';
          }
        }
      }
    }

    return parsed;
  } catch {
    logger.warn('ARIA JSON parse failed', { raw });
    return {
      message: 'Maafi, kuch technical problem aayi. Kripya dobara try karein.',
      extracted: {},
      next_slot: nextSlot?.key || null,
      profile_complete: false,
      confidence: 0,
    };
  }
}

// ── Notice/Document plain-language explanation ────────────────────────────────

async function ariaSummarizeNotice(noticeText) {
  const response = await groq.chat.completions.create({
    model: config.groq.model,
    messages: [
      {
        role: 'system',
        content: `You are ARIA, a Hindi-language compliance assistant for Indian MSMEs.
A user has sent a government notice. Your job:
1. Explain it in simple Hindi/Hinglish that a small shop owner can understand.
2. Identify the due date.
3. Identify the penalty if not acted upon (use statutory rates, not guesses).
4. Give them the exact next action.
5. Cite the legal section/rule if visible in the notice.

Return JSON:
{
  "summary_hindi": "plain Hindi summary",
  "due_date": "DD/MM/YYYY or null",
  "penalty_risk_inr": number_or_null,
  "next_action": "what to do next",
  "legal_section": "section cited in notice",
  "source_url": "official URL if identifiable",
  "confidence": 0.0-1.0
}`,
      },
      { role: 'user', content: `Notice text:\n\n${noticeText}` },
    ],
    temperature: 0,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { summary_hindi: 'Notice samajhne mein problem aayi.', confidence: 0 };
  }
}

export {
  ariaChat,
  ariaSummarizeNotice,
  getMissingSlots,
  getNextSlot,
  PROFILE_SLOTS,
};
export default {
  ariaChat,
  ariaSummarizeNotice,
  getMissingSlots,
  getNextSlot,
  PROFILE_SLOTS,
};
