import * as alertRepo from '../../repos/alertRepo.js';
import * as deadlineRepo from '../../repos/deadlineRepo.js';

const HOME_MESSAGES = {
  upload: {
    hi: 'दस्तावेज़ अपलोड करने के लिए कृपया Upload विकल्प खोलें और PDF या साफ़ फोटो चुनें।',
    en: 'To upload a document, open Upload and choose a PDF or clear photo.',
    hinglish: 'Document upload karne ke liye Upload option kholen aur PDF ya clear photo chunein.',
  },
  card: {
    hi: 'नमस्ते! आज मैं आपकी कैसे मदद करूँ?',
    en: 'Welcome back. How can I help today?',
    hinglish: 'Namaste! Aaj main aapki kaise madad karun?',
  },
  emptyDeadlines: {
    hi: 'अभी कोई आने वाली समय-सीमा दर्ज नहीं है।',
    en: 'There are no upcoming deadlines saved yet.',
    hinglish: 'Abhi koi upcoming deadline saved nahi hai.',
  },
  emptyAlerts: {
    hi: 'अभी कोई हालिया SENTINEL अलर्ट नहीं है।',
    en: 'There are no recent SENTINEL alerts.',
    hinglish: 'Abhi koi recent SENTINEL alert nahi hai.',
  },
};

function languageOf(state) {
  return state.conversation.language || 'hinglish';
}

function formatDate(value, locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN');
}

export async function homeNode(state, intent) {
  const language = languageOf(state);
  if (intent === 'upload' || intent === 'card') {
    const message = intent === 'card'
      ? {
        type: 'option_card',
        id: 'home-menu',
        text: HOME_MESSAGES.card[language],
        options: [
          { id: 'SCHEME_REQUEST', label: language === 'en' ? 'Schemes' : language === 'hi' ? 'योजनाएँ' : 'Yojana' },
          { id: 'DEADLINES', label: language === 'en' ? 'Deadlines' : language === 'hi' ? 'समय-सीमा' : 'Deadlines' },
          { id: 'UPLOAD', label: language === 'en' ? 'Upload document' : language === 'hi' ? 'दस्तावेज़ अपलोड' : 'Document upload' },
        ],
      }
      : { type: 'text', text: HOME_MESSAGES.upload[language] };
    return { status: 'OK', messages: [message], claims: [], trace: [] };
  }

  if (intent === 'deadlines') {
    const rows = await deadlineRepo.listUpcomingForUser(state.userId);
    if (!rows.length) return { status: 'OK', messages: [{ type: 'text', text: HOME_MESSAGES.emptyDeadlines[language] }], claims: [], trace: [] };
    return {
      status: 'OK',
      messages: [{
        type: 'list',
        text: language === 'en' ? 'Upcoming deadlines' : language === 'hi' ? 'आने वाली समय-सीमाएँ' : 'Upcoming deadlines',
        items: rows.map((item) => ({
          title: item.title,
          details: formatDate(item.deadlineDate, language),
          tags: [item.urgency || 'medium'],
          ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
        })),
      }],
      claims: [],
      trace: [],
    };
  }

  if (intent === 'alerts') {
    const rows = await alertRepo.listRecentForUser(state.userId);
    if (!rows.length) return { status: 'OK', messages: [{ type: 'text', text: HOME_MESSAGES.emptyAlerts[language] }], claims: [], trace: [] };
    return {
      status: 'OK',
      messages: [{
        type: 'list',
        text: language === 'en' ? 'Recent SENTINEL alerts' : language === 'hi' ? 'हालिया SENTINEL अलर्ट' : 'Recent SENTINEL alerts',
        items: rows.map((item) => ({
          title: `${item.isSimulated ? 'Simulated alert: ' : ''}${item.title}`,
          details: item.summary,
          tags: [item.status || 'unread'],
          sourceUrl: item.sourceUrl,
          lastVerified: item.lastVerifiedAt,
        })),
      }],
      claims: [],
      trace: [],
    };
  }

  return { status: 'OK', messages: [], claims: [], trace: [] };
}

export default homeNode;
