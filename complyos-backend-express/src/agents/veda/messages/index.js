/**
 * ComplianceOS — VEDA Multilingual Message Templates (Hi / En / Hinglish)
 * Channel-neutral OutboundMessage format. Warm, concise tone.
 */

export const DISCLAIMER = {
  hinglish: 'Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.',
  hi: 'यह जानकारी केवल समझने के लिए है, पेशेवर सलाह नहीं।',
  en: 'This information is for guidance only, not professional legal/tax advice.',
};

export const RETAKE_TIPS = {
  hinglish: [
    'Achhi roshni mein photo lein (shadow na ho)',
    'Document ko seedha aur flat rakhein',
    'Poora panna dikhna chahiye, chaaron kone cover ho',
  ],
  hi: [
    'अच्छी रोशनी में फोटो लें (छाया न पड़े)',
    'दस्तावेज़ को सीधा और सपाट रखें',
    'पूरा पन्ना दिखना चाहिए, चारों कोने शामिल हों',
  ],
  en: [
    'Capture in good lighting without shadows',
    'Keep document flat and aligned',
    'Ensure all four corners are visible in frame',
  ],
};

export const MESSAGES = {
  unclear_photo: {
    hinglish: (tips) =>
      `Photo clear nahi hai, dobara bhejein.\n\nTips:\n• ${tips.join('\n• ')}\n\n${DISCLAIMER.hinglish}`,
    hi: (tips) =>
      `फोटो साफ नहीं है, कृपया दोबारा भेजें।\n\nसुझाव:\n• ${tips.join('\n• ')}\n\n${DISCLAIMER.hi}`,
    en: (tips) =>
      `Photo is unclear, please retake and send again.\n\nTips:\n• ${tips.join('\n• ')}\n\n${DISCLAIMER.en}`,
  },

  unsupported_mime: {
    hinglish: 'Kripya sirf JPG, PNG image ya PDF document hi bhejein.',
    hi: 'कृपया केवल JPG, PNG फोटो या PDF दस्तावेज़ ही भेजें।',
    en: 'Please upload only JPG, PNG images or PDF documents.',
  },

  degraded_ocr: {
    hinglish: 'Abhi document padhne mein dikkat hai, thodi der baad try karein.',
    hi: 'अभी दस्तावेज़ पढ़ने में समस्या आ रही है, कृपया कुछ देर बाद प्रयास करें।',
    en: 'Currently experiencing difficulty processing documents. Please try again shortly.',
  },

  generic_error: {
    hinglish: 'Kuch takneeki kharabi aayi hai. Kripya thodi der baad dubara koshish karein.',
    hi: 'कुछ तकनीकी खराबी आई है। कृपया कुछ देर बाद दोबारा प्रयास करें।',
    en: 'An unexpected technical issue occurred. Please try again in a few moments.',
  },

  doc_verified: {
    hinglish: (docType) => `Aapka ${docType} safaltapoorvak verify ho gaya hai.`,
    hi: (docType) => `आपका ${docType} सफलतापूर्वक सत्यापित हो गया है।`,
    en: (docType) => `Your ${docType} has been successfully verified.`,
  },
};

/**
 * Format a text OutboundMessage
 * @param {string} key
 * @param {string} [locale='hinglish']
 * @param {any} [arg]
 * @returns {object}
 */
export function getTextMessage(key, locale = 'hinglish', arg) {
  const loc = ['hi', 'en', 'hinglish'].includes(locale) ? locale : 'hinglish';
  const tmpl = MESSAGES[key]?.[loc] || MESSAGES[key]?.hinglish;

  let text = '';
  if (typeof tmpl === 'function') {
    text = tmpl(arg || RETAKE_TIPS[loc]);
  } else {
    text = tmpl || '';
  }

  return {
    type: 'text',
    text,
  };
}

export default {
  DISCLAIMER,
  RETAKE_TIPS,
  MESSAGES,
  getTextMessage,
};
