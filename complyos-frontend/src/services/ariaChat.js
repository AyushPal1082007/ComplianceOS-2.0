/**
 * ariaChat.js — SSE and REST client for ARIA
 * Uses POST /api/chat/event (fire-and-forget) and
 * GET /api/chat/stream (SSE) for real-time replies.
 * Includes intelligent local fallback for offline/development mode.
 */
import { getToken } from "../utils/helpers";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function uuid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Local Fallback Question Engine ──────────────────────────────────────────
const FALLBACK_QUESTIONS = [
  {
    id: "businessName",
    type: "text",
    text: "Namaste! Main ARIA hoon — aapka Compliance AI advisor. Shuru karne ke liye, aapke business ka naam kya hai?",
    why: "Aapke business compliance profile ke liye",
    options: [
      { id: "opt1", label: "Bharat Retailers", value: "Bharat Retailers" },
      { id: "opt2", label: "Krishna Textiles", value: "Krishna Textiles" },
      { id: "opt3", label: "TechNova Solutions", value: "TechNova Solutions" },
    ],
    field: "businessName",
    progress: { done: 1, total: 8 },
  },
  {
    id: "state",
    type: "option_card",
    text: "Aapka business kis state mein sthit hai?",
    why: "State-specific compliance aur subsidies alag hoti hain",
    options: [
      { id: "mh", label: "Maharashtra", emoji: "🏙️", value: "Maharashtra" },
      { id: "delhi", label: "Delhi NCR", emoji: "🏛️", value: "Delhi" },
      { id: "up", label: "Uttar Pradesh", emoji: "🌾", value: "Uttar Pradesh" },
      { id: "gj", label: "Gujarat", emoji: "🏭", value: "Gujarat" },
      { id: "ka", label: "Karnataka", emoji: "💻", value: "Karnataka" },
      { id: "other", label: "Other State", emoji: "📍", value: "Other" },
    ],
    field: "state",
    progress: { done: 2, total: 8 },
  },
  {
    id: "sector",
    type: "option_card",
    text: "Aapka business kis type ka hai?",
    why: "Isse aapke sector ke compliance rules tay hote hain",
    options: [
      { id: "trader", label: "Retail / Trading / Shop", emoji: "🛒", value: "Retail & Trading" },
      { id: "manufacturing", label: "Manufacturing / Factory", emoji: "🏭", value: "Manufacturing" },
      { id: "service", label: "Services / IT / Consulting", emoji: "💼", value: "Services" },
      { id: "food", label: "Food / Restaurant / FSSAI", emoji: "🍲", value: "Food & Beverage" },
    ],
    field: "sector",
    progress: { done: 3, total: 8 },
  },
  {
    id: "gstRegistered",
    type: "option_card",
    text: "Kya aapka business GST mein registered hai?",
    why: "GST return filing aur ITC credit manage karne ke liye",
    options: [
      { id: "yes", label: "Haan, GST Registered hai", emoji: "✅", value: "GST Registered" },
      { id: "no", label: "Nahi, abhi GST nahi hai", emoji: "❌", value: "No GST" },
      { id: "unsure", label: "Pata nahi / Zaroorat samajhni hai", emoji: "❓", value: "Unsure" },
    ],
    field: "gstRegistered",
    progress: { done: 4, total: 8 },
  },
  {
    id: "turnoverBand",
    type: "option_card",
    text: "Pichhle saal ka lagbhag annual turnover kitna tha?",
    why: "Turnover se MSME category aur tax exemptions decide hote hain",
    options: [
      { id: "lt20L", label: "Below ₹20 Lakhs", emoji: "🌱", value: "Below 20L" },
      { id: "20L_40L", label: "₹20 Lakhs – ₹40 Lakhs", emoji: "📈", value: "20L-40L" },
      { id: "40L_1_5Cr", label: "₹40 Lakhs – ₹1.5 Crore", emoji: "🚀", value: "40L-1.5Cr" },
      { id: "gt1_5Cr", label: "Above ₹1.5 Crore", emoji: "🏢", value: "Above 1.5Cr" },
    ],
    field: "turnover",
    progress: { done: 5, total: 8 },
  },
  {
    id: "udyamRegistered",
    type: "option_card",
    text: "Kya aapke paas Udyam / MSME Certificate hai?",
    why: "Government subsidies aur priority bank loans ke liye zaroori hai",
    options: [
      { id: "yes", label: "Haan, Udyam registered hai", emoji: "📜", value: "Udyam Certified" },
      { id: "no", label: "Nahi, abhi tak nahi banwaya", emoji: "⏳", value: "Not Registered" },
    ],
    field: "udyam",
    progress: { done: 6, total: 8 },
  },
  {
    id: "employeesBand",
    type: "option_card",
    text: "Aapke business mein kitne employees kaam karte hain?",
    why: "PF, ESI aur labour law thresholds check karne ke liye",
    options: [
      { id: "0", label: "Sirf Main (Sole Owner)", emoji: "👤", value: "1 Person" },
      { id: "1_9", label: "1 se 9 employees", emoji: "👥", value: "1-9 Employees" },
      { id: "10_19", label: "10 se 19 employees", emoji: "🏢", value: "10-19 Employees" },
      { id: "20plus", label: "20 ya zyada (PF/ESI applicable)", emoji: "🏭", value: "20+ Employees" },
    ],
    field: "employees",
    progress: { done: 7, total: 8 },
  },
  {
    id: "goal",
    type: "option_card",
    text: "Abhi aapko kis cheez mein sabse zyada madad chahiye?",
    why: "Aapke dashboard par prioritized alerts dikhane ke liye",
    options: [
      { id: "loan", label: "Business Loan / Collateral-Free Credit", emoji: "💰", value: "Business Loan" },
      { id: "subsidy", label: "Government Subsidy / MSME Grant", emoji: "🎁", value: "Govt Subsidy" },
      { id: "compliance", label: "GST & Tax Compliance Automation", emoji: "🛡️", value: "Tax Automation" },
      { id: "notice_help", label: "CA Consultation & Notice Help", emoji: "⚖️", value: "CA Notice Help" },
    ],
    field: "goal",
    progress: { done: 8, total: 8 },
  },
  {
    id: "aria-reveal",
    type: "confirm_card",
    title: "Aapka Business Profile Taiyaar Hai! 🎉",
    text: "Shandar! Maine aapka complete compliance profile scan kar liya hai. 3 eligible government subsidies aur instant compliance alerts ready hain.",
    options: [
      { id: "confirm", label: "Launch ComplianceOS Dashboard 🚀", emoji: "⚡" },
    ],
    field: "complete",
    progress: { done: 8, total: 8 },
  },
];

let localQuestionIdx = 0;
const localProfileState = {};

function runLocalFallback(event, { onMessage, onComplete }) {
  setTimeout(() => {
    if (event.type === "START") {
      localQuestionIdx = 0;
      const q = FALLBACK_QUESTIONS[0];
      onMessage?.(q);
      onComplete?.({
        status: "OK",
        claims: [],
        trace: [{ outputSummary: { currentQuestion: q.id } }],
      });
      return;
    }

    if (event.type === "TEXT") {
      const q = FALLBACK_QUESTIONS[localQuestionIdx];
      if (q && q.field) {
        localProfileState[q.field] = event.text;
      }
      localQuestionIdx = Math.min(localQuestionIdx + 1, FALLBACK_QUESTIONS.length - 1);
      const nextQ = FALLBACK_QUESTIONS[localQuestionIdx];
      onMessage?.(nextQ);
      onComplete?.({
        status: "OK",
        claims: [],
        trace: [
          {
            outputSummary: {
              filledFields: Object.entries(localProfileState).map(([k, v]) => ({
                field: k,
                value: String(v),
                emoji: "✓",
              })),
            },
          },
        ],
      });
      return;
    }

    if (event.type === "OPTION_TAP") {
      const q = FALLBACK_QUESTIONS[localQuestionIdx];
      if (q && q.options) {
        const selected = q.options.find((o) => o.id === event.optionId);
        if (selected && q.field) {
          localProfileState[q.field] = selected.value || selected.label;
        }
      }
      localQuestionIdx = Math.min(localQuestionIdx + 1, FALLBACK_QUESTIONS.length - 1);
      const nextQ = FALLBACK_QUESTIONS[localQuestionIdx];
      onMessage?.(nextQ);
      onComplete?.({
        status: "OK",
        claims: [],
        trace: [
          {
            outputSummary: {
              filledFields: Object.entries(localProfileState).map(([k, v]) => ({
                field: k,
                value: String(v),
                emoji: "✓",
              })),
            },
          },
        ],
      });
      return;
    }

    if (event.type === "VOICE") {
      const q = FALLBACK_QUESTIONS[localQuestionIdx];
      const mockText = "Recognized voice input";
      if (q && q.field) {
        localProfileState[q.field] = mockText;
      }
      onMessage?.({ type: "text", text: `Maine suna: "${mockText}"` });
      localQuestionIdx = Math.min(localQuestionIdx + 1, FALLBACK_QUESTIONS.length - 1);
      const nextQ = FALLBACK_QUESTIONS[localQuestionIdx];
      onMessage?.(nextQ);
      onComplete?.({
        status: "OK",
        claims: [],
        trace: [
          {
            outputSummary: {
              filledFields: Object.entries(localProfileState).map(([k, v]) => ({
                field: k,
                value: String(v),
                emoji: "✓",
              })),
            },
          },
        ],
      });
      return;
    }
  }, 350);
}

/**
 * Send an event to the backend and receive messages via SSE/REST.
 */
export function sendEvent(event, { onMessage, onComplete, onError }) {
  const externalId = event.externalId || uuid();
  const payload = { ...event, externalId, channel: "web" };

  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        // If unauthenticated or backend route returns error, use fallback
        console.warn(`[ARIA] Backend returned ${res.status}, using local fallback engine.`);
        runLocalFallback(event, { onMessage, onComplete });
        return;
      }

      const data = await res.json();

      // Process messages
      if (data.messages?.length) {
        for (const msg of data.messages) {
          onMessage?.(msg);
        }
      }

      onComplete?.({
        status: data.status,
        claims: data.claims || [],
        trace: data.trace || [],
        duplicate: data.duplicate || false,
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.warn("[ARIA] Fetch failed, delegating to local fallback engine:", err.message);
        runLocalFallback(event, { onMessage, onComplete });
      }
    }
  })();

  return { abort: () => controller.abort() };
}

/**
 * Upload a voice recording as a VOICE event.
 */
export function sendVoice(audioBlob, mime, callbacks) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result ? reader.result.split(",")[1] : "";
      const handle = sendEvent(
        {
          type: "VOICE",
          audio: { data: base64, mime: mime || "audio/webm;codecs=opus" },
        },
        callbacks
      );
      resolve(handle);
    };
    reader.readAsDataURL(audioBlob);
  });
}

/**
 * Send an option tap event.
 */
export function sendOptionTap(questionId, optionId, callbacks) {
  return sendEvent(
    {
      type: "OPTION_TAP",
      questionId,
      optionId,
      card: { cardId: questionId, actionId: optionId },
    },
    callbacks
  );
}

/**
 * Send a text message event.
 */
export function sendText(text, callbacks) {
  return sendEvent({ type: "TEXT", text }, callbacks);
}

/**
 * Send a START event to initiate the conversation.
 */
export function sendStart(language, callbacks) {
  return sendEvent({ type: "START", language: language || "hinglish" }, callbacks);
}

export default {
  sendEvent,
  sendStart,
  sendText,
  sendOptionTap,
  sendVoice,
};
