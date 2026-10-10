import 'dotenv/config';

/**
 * ComplianceOS — ARIA Messages Configuration (ES6 Module)
 * All hardcoded messages moved here for easy customization
 */

const ARIA_MESSAGES = {
  // Greeting
  WELCOME: {
    hi: 'नमस्ते! मैं ARIA हूँ। आपकी बिज़नेस प्रोफ़ाइल बनाने में मदद करूँगी। आप किस राज्य में हैं?',
    en: 'Hello! I am ARIA. I will help you build your business profile. Which state are you in?',
    hinglish: 'Namaste! Main ARIA hoon. Aapki business profile banane mein madad karungi. Aap kis state mein hain?',
  },

  // Off-topic responses
  OFF_TOPIC: {
    hi: 'मैं अभी सिर्फ आपकी जानकारी समझ रही हूँ। पहले प्रोफ़ाइल पूरी कर लें, फिर आपके सवाल पर मदद मिलेगी।',
    en: 'I am collecting your business profile right now. Let us finish that first, then I can help route your question.',
    hinglish: 'Main abhi sirf aapki jaankari samajh rahi hoon. Pehle profile poori kar lein, phir aapke sawaal par madad milegi.',
  },

  // Error messages
  SAFE_ERROR: {
    hi: 'अभी तकनीकी दिक्कत है। कृपया थोड़ी देर बाद फिर कोशिश करें।',
    en: 'A technical issue occurred. Please try again shortly.',
    hinglish: 'Abhi technical dikkat hai. Thodi der baad phir try karein.',
  },

  // Completion messages
  COMPLETION_TEXT: {
    hi: 'अब तक आपकी जानकारी पूरी हो गई है। अगर GST ya Udyam certificate ki photo bhejein, to main sab verify kar dungi।',
    en: 'Your profile is complete. If you send a photo of your GST or Udyam certificate, I will verify everything.',
    hinglish: 'Abhi tak aapki jaankari poori ho gayi hai. Agar GST ya Udyam certificate ki photo bhejein, to main sab verify kar dungi.',
  },

  // Reveal message (profile summary)
  REVEAL_TITLE: {
    hi: 'आपकी प्रोफ़ाइल सारांश',
    en: 'Your Profile Summary',
    hinglish: 'Aapki Profile Summary',
  },

  // Confirmation messages
  CONFIRM_PROMPT: {
    hi: 'कृपया इन विवरणों की पुष्टि करें',
    en: 'Please verify these details',
    hinglish: 'Kripya in details ko verify karein',
  },

  // Scheme teaser
  SCHEME_TEASER: {
    hi: (count) => `अब तक ${count} योजनाएँ आपके लिए possible हो सकती हैं।`,
    en: (count) => `${count} schemes may be possible for you.`,
    hinglish: (count) => `Abhi tak ${count} yojnaayein aapke liye possible ho sakti hain.`,
  },

  // Skip options
  SKIP_OPTIONS: {
    id: 'skip',
    label: {
      hi: 'छोड़ें',
      en: 'Skip',
      hinglish: 'Skip',
    },
  },

  // Unsure options
  UNSURE_OPTIONS: {
    id: 'unsure',
    label: {
      hi: 'मुझे नहीं पता',
      en: 'Not sure',
      hinglish: 'Not sure',
    },
  },

  // Back options
  BACK_OPTIONS: {
    id: 'back',
    label: {
      hi: 'वापस',
      en: 'Back',
      hinglish: 'Back',
    },
  },

  // Finish options
  FINISH_OPTIONS: {
    id: 'finish',
    label: {
      hi: 'सब कुछ ठीक है',
      en: 'All good',
      hinglish: 'All good',
    },
  },

  // Edit options
  EDIT_OPTIONS: {
    id: 'edit',
    label: {
      hi: 'बदलें',
      en: 'Edit',
      hinglish: 'Edit',
    },
  },

  // Language switching
  LANGUAGE_SWITCHED: {
    hi: 'भाषा बदल दी गई है। अब हिंदी/हिंगलिश में जवाब दें।',
    en: 'Language switched. Please answer in Hindi/Hinglish now.',
    hinglish: 'Bhasha badal di gayi hai. Ab Hindi/Hinglish mein jawab dein.',
  },

  // Not understood
  NOT_UNDERSTOOD: {
    hi: 'मुझे समझ नहीं आया। कृपया दोबारा कहें या कोई दूसरा तरीका आजमाएं।',
    en: 'I didn\'t understand. Please say it again or try another way.',
    hinglish: 'Mujhe samajh nahi aaya. Kripya dobara kahen ya koi dusra tareeka aajmayein.',
  },

  // Why this question
  WHY_QUESTION: {
    hi: 'यह जानकारी आपकी व्यवसाय के लिए जरूरी है और आपको सही सरकारी योजनाओं से लाभ मिल सकता है।',
    en: 'This information is required for your business and can help you access the right government schemes.',
    hinglish: 'Yeh jaankari aapki vyavsaay ke liye jaroori hai aur aapko sahi Sarkari yojanaon se labh mil sakta hai.',
  },

  // Turn limit reached
  TURN_LIMIT_REACHED: {
    hi: 'मैंने अधिकतम प्रश्न पूछ लिए हैं। आपकी प्रोफ़ाइल अब पूरी है।',
    en: 'I have asked the maximum number of questions. Your profile is now complete.',
    hinglish: 'Mainne adhikat prashn pooch liye hain. Aapki profile ab poori hai.',
  },

  // Disclaimer (shown at the end)
  DISCLAIMER: {
    hi: 'यह जानकारी केवल समझने के लिए है, पेशेवर सलाह नहीं।',
    en: 'This information is for understanding only, not professional advice.',
    hinglish: 'Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.',
  },
};

// Export configuration
export default ARIA_MESSAGES;
