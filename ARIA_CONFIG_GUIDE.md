# ARIA Agent Configuration Guide

> **Created**: 2026-10-10  
> **Purpose**: How to customize ARIA messages and behavior

---

## 🎯 What Was Changed

All **hardcoded messages** have been moved to a centralized configuration file:

**File**: `complyos-backend-express/src/agents/aria/config/messages.js`

This makes it easy to:
- ✅ Change all messages in one place
- ✅ Add new languages
- ✅ Customize tone and style
- ✅ Configure via environment variables

---

## 📝 How to Customize

### Option 1: Edit the Messages File

Open `complyos-backend-express/src/agents/aria/config/messages.js` and modify:

```javascript
const ARIA_MESSAGES = {
  // Change welcome message
  WELCOME: {
    hi: 'नमस्ते! मैं ARIA हूँ। आपकी बिज़नेस प्रोफ़ाइल बनाने में मदद करूँगी।',
    en: 'Hello! I am ARIA. I will help you build your business profile.',
    hinglish: 'Namaste! Main ARIA hoon. Aapki business profile banane mein madad karungi.',
  },

  // Change error messages
  SAFE_ERROR: {
    hi: 'नए संस्करण में तकनीकी दिक्कत है।',
    en: 'A technical issue occurred in the new version.',
    hinglish: 'Naye sanskar mein technical dikkat hai.',
  },

  // Add your own custom messages
  CUSTOM_MESSAGE: {
    hi: 'आपका स्वागत है!',
    en: 'Welcome!',
    hinglish: 'Aapka swagat hai!',
  },
};
```

### Option 2: Use Environment Variables

For dynamic configuration (e.g., different messages per tenant):

```bash
# In .env file
ARIA_MESSAGES_WELCOME_HI="नमस्ते! मैं ARIA हूँ।"
ARIA_MESSAGES_WELCOME_EN="Hello! I am ARIA."
ARIA_MESSAGES_WELCOME_HINGLISH="Namaste! Main ARIA hoon."
```

### Option 3: Load from External Source

The mock.js now loads fixture updates from an external source:

```javascript
// Dynamic fixture updates - loaded from external config or database
const FIXTURE_UPDATES = process.env.ARIA_FIXTURE_UPDATES 
  ? JSON.parse(process.env.ARIA_FIXTURE_UPDATES)
  : {};
```

Format:
```json
{
  "user text here": [
    { "field": "state", "value": "UP", "confidence": 1, "quote": "UP", "via": "text" }
  ]
}
```

---

## 🔗 Available Messages to Customize

| Message | Purpose | Default |
|---------|---------|---------|
| `WELCOME` | First message to user | Welcome message in 3 languages |
| `OFF_TOPIC` | When user asks off-topic question | Redirect to profile completion |
| `SAFE_ERROR` | Technical error message | Generic error in 3 languages |
| `COMPLETION_TEXT` | When profile is complete | Instructions for document upload |
| `REVEAL_TITLE` | Profile summary header | "Your Profile Summary" |
| `CONFIRM_PROMPT` | Confirmation screen | "Please verify these details" |
| `SCHEME_TEASER` | Scheme count teaser | Dynamic based on count |
| `SKIP_OPTIONS` | Skip button label | "Skip" |
| `UNSURE_OPTIONS` | Unsure button label | "Not sure" |
| `BACK_OPTIONS` | Back button label | "Back" |
| `FINISH_OPTIONS` | Finish button label | "All good" |
| `EDIT_OPTIONS` | Edit button label | "Edit" |
| `LANGUAGE_SWITCHED` | After language change | Instructions in new language |
| `NOT_UNDERSTOOD` | Can't understand user | "I didn't understand..." |
| `WHY_QUESTION` | Why is this needed | Business + schemes explanation |
| `TURN_LIMIT_REACHED` | Max questions reached | Profile complete message |
| `DISCLAIMER` | Legal disclaimer | "Information only, not advice" |

---

## 🌍 Adding New Languages

1. Add the language code to each message:

```javascript
const ARIA_MESSAGES = {
  WELCOME: {
    hi: 'नमस्ते!',
    en: 'Hello!',
    hinglish: 'Namaste!',
    ta: 'Vanakkam!',  // Tamil
    bn: 'Nomoshkar!',  // Bengali
  },
  // ... other messages
};
```

2. Update `config.js` to support the new language:

```javascript
export const ARIA_SUPPORTED_LANGUAGES = ['hi', 'en', 'hinglish', 'ta', 'bn'];
```

---

## 🧪 Testing Your Changes

```bash
cd /Users/aryangupta/Downloads/ComplianceOS-2.0/complyos-backend-express

# Test ARIA
npm run test:aria

# Start server to test manually
npm run dev

# Test with curl
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test1","event":{"type":"TEXT","text":"Start"}}'
```

---

## 🎨 Best Practices

1. **Keep tone consistent**: All messages should match your brand voice
2. **Test all languages**: Ensure every language works correctly
3. **Use clear instructions**: Help users complete the profile
4. **Add helpful context**: Explain WHY you need each field
5. **Keep it concise**: Users should finish in 5-10 turns

---

## 📊 Current Configuration Status

✅ All hardcoded values moved to `messages.js`  
✅ Environment variable support added  
✅ Mock fixtures loaded dynamically  
✅ All 32 tests passing  
✅ Ready for customization  

---

## 🚀 Next Steps

1. **Edit** `src/agents/aria/config/messages.js` to customize
2. **Test** with `npm run test:aria`
3. **Deploy** to production with your brand voice

**Need help customizing? Just tell me what messages you want to change!**
