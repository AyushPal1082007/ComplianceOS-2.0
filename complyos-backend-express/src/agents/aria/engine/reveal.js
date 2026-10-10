const REVEAL_TEXT = {
  hi: (profile) => `आप ${profile.state || 'अपने राज्य'} में ${profile.sector || 'अपना कारोबार'} चलाते हैं; GST ${profile.gstRegistered ? 'हाँ' : 'नहीं'}, कारोबार श्रेणी ${profile.turnoverBand || 'अभी पता नहीं'}। क्या यह सही है?`,
  en: (profile) => `Your business is in ${profile.state || 'your state'} and works in ${profile.sector || 'your sector'}; GST ${profile.gstRegistered ? 'yes' : 'no'}, turnover band ${profile.turnoverBand || 'not shared yet'}. Is this correct?`,
  hinglish: (profile) => `Aap ${profile.state || 'apne state'} mein ${profile.sector || 'apna business'} chalate hain; GST ${profile.gstRegistered ? 'haan' : 'nahi'}, turnover band ${profile.turnoverBand || 'abhi pata nahi'}. Kya yeh sahi hai?`,
};

export function buildReveal(profile, language = 'hinglish') {
  const summary = REVEAL_TEXT[language] || REVEAL_TEXT.hinglish;
  return {
    type: 'confirm_card', id: 'aria-reveal', text: summary(profile),
    actions: [
      { id: 'continue', label: language === 'en' ? 'Continue' : language === 'hi' ? 'आगे बढ़ें' : 'Aage badhein' },
      { id: 'finish', label: language === 'en' ? 'Finish' : language === 'hi' ? 'यहीं पूरा करें' : 'Yahin complete karein' },
      { id: 'edit', label: language === 'en' ? 'Change something' : language === 'hi' ? 'कुछ बदलें' : 'Kuch badlo' },
    ],
  };
}
