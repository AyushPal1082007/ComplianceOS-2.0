import { deleteUserData } from '../../delete/deleteUserData.js';
import { isDeleteRequest } from '../router.js';

function actionOf(event = {}) {
  return String(event.action || event.actionId || event.card?.actionId || '').toLowerCase();
}

const CONFIRM_TEXT = {
  hi: 'क्या आप अपना डेटा हटाना चाहते हैं? इसे वापस नहीं किया जा सकता।',
  en: 'Do you want to delete your data? This cannot be undone.',
  hinglish: 'Kya aap apna data delete karna chahte hain? Isse wapas nahi kiya ja sakta.',
};
const DELETED_TEXT = {
  hi: 'आपका डेटा हटा दिया गया है। आवश्यक भुगतान और सहमति रिकॉर्ड सुरक्षित रखे गए हैं।',
  en: 'Your data has been deleted. Required payment and consent records were retained.',
  hinglish: 'Aapka data delete kar diya gaya hai. Zaroori payment aur consent records rakhe gaye hain.',
};
const CANCELLED_TEXT = {
  hi: 'डेटा हटाने की पुष्टि रद्द कर दी गई है।',
  en: 'Data deletion was cancelled.',
  hinglish: 'Data deletion cancel kar diya gaya hai.',
};

export async function deleteGuardNode(state, { removeData = deleteUserData } = {}) {
  const language = ['hi', 'en', 'hinglish'].includes(state.conversation.language)
    ? state.conversation.language
    : 'hinglish';
  const pending = Boolean(state.conversation.pendingDelete);
  const action = actionOf(state.event);

  if (pending && ['confirm', 'yes', 'delete'].includes(action)) {
    await removeData(state.userId);
    return {
      handled: true,
      deleted: true,
      status: 'OK',
      conversation: null,
      messages: [{ type: 'text', text: DELETED_TEXT[language] }],
    };
  }

  if (pending && ['cancel', 'no'].includes(action)) {
    return {
      handled: true,
      cancelled: true,
      conversation: { ...state.conversation, pendingDelete: false, phase: 'intake' },
      messages: [{ type: 'text', text: CANCELLED_TEXT[language] }],
    };
  }

  if (!pending && state.event.type === 'DELETE_CONFIRM') {
    return {
      handled: true,
      status: 'NEEDS_INPUT',
      messages: [{ type: 'text', text: CANCELLED_TEXT[language] }],
    };
  }

  if (pending) {
    const conversation = { ...state.conversation, pendingDelete: false, phase: 'intake' };
    return {
      handled: false,
      cancelled: true,
      conversation,
      messages: [{ type: 'text', text: CANCELLED_TEXT[language] }],
    };
  }

  if (isDeleteRequest(state.event)) {
    return {
      handled: true,
      status: 'NEEDS_CONFIRMATION',
      conversation: {
        ...state.conversation,
        phase: 'deleting',
        pendingDelete: true,
        outstandingCards: { ...state.conversation.outstandingCards, delete: 'SYSTEM' },
      },
      messages: [{
        type: 'confirm_card',
        id: 'delete-confirm',
        text: CONFIRM_TEXT[language],
        actions: [
          { id: 'confirm', label: language === 'en' ? 'Delete my data' : language === 'hi' ? 'डेटा हटाएँ' : 'Data delete karein' },
          { id: 'cancel', label: language === 'en' ? 'Cancel' : language === 'hi' ? 'रद्द करें' : 'Cancel' },
        ],
      }],
    };
  }

  return { handled: false };
}

export default deleteGuardNode;
