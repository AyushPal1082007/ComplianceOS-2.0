import * as consentRepo from '../../repos/consentRepo.js';

const CONSENT_TEXT = {
  hi: 'क्या आप अपनी जानकारी ComplianceOS के साथ प्रोफ़ाइल और अनुपालन सहायता के लिए उपयोग करने की अनुमति देते हैं?',
  en: 'Do you consent to ComplianceOS using your information for your profile and compliance assistance?',
  hinglish: 'Kya aap profile aur compliance madad ke liye apni jaankari ComplianceOS ke saath use karne ki sahmati dete hain?',
};
const DECLINED_TEXT = {
  hi: 'ठीक है। आपकी जानकारी संसाधित नहीं की गई है। जब चाहें सहमति दे सकते हैं।',
  en: 'Understood. Your information was not processed. You can opt in whenever you are ready.',
  hinglish: 'Theek hai. Aapki jaankari process nahi ki gayi. Jab chahein sahmati de sakte hain.',
};

function consentAction(event = {}) {
  const action = String(event.action || event.card?.actionId || event.actionId || '').toLowerCase();
  if (event.accepted === true || ['accept', 'yes', 'consent', 'agree'].includes(action)) return 'accept';
  if (event.accepted === false || ['decline', 'no', 'deny'].includes(action)) return 'decline';
  return null;
}

export async function consentGateNode(state) {
  if (state.user?.consentGiven) return { handled: false };
  const language = ['hi', 'en', 'hinglish'].includes(state.event?.language) ? state.event.language : 'hinglish';
  const action = state.event?.type === 'CONSENT' ? consentAction(state.event) : null;

  if (action === 'decline') {
    return { handled: true, consentBlocked: true, status: 'NEEDS_INPUT', messages: [{ type: 'text', text: DECLINED_TEXT[language] }] };
  }
  if (action !== 'accept') {
    return {
      handled: true,
      consentBlocked: true,
      status: 'NEEDS_CONFIRMATION',
      messages: [{
        type: 'confirm_card',
        id: 'consent',
        text: CONSENT_TEXT[language],
        actions: [
          { id: 'accept', label: language === 'en' ? 'I agree' : language === 'hi' ? 'सहमति दें' : 'Haan, sahmati hai' },
          { id: 'decline', label: language === 'en' ? 'No' : language === 'hi' ? 'नहीं' : 'Nahi' },
        ],
      }],
    };
  }

  const consentAt = new Date();
  await consentRepo.accept(state.userId, state.event.channel, 'consent-v1', consentAt);
  return { handled: false, accepted: true, consentAt };
}

export default consentGateNode;
