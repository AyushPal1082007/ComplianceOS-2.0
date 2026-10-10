import 'dotenv/config';

/**
 * ComplianceOS — Central Configuration (ES6 Module)
 * All env vars validated here; fail fast on missing critical vars.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/complyos_db',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama3-70b-8192',
    rateLimitDelay: 2100, // ms between calls to stay under 30 RPM
  },

  // Sarvam AI — Indian sovereign speech & language APIs (replaces Bhashini)
  // Docs: https://docs.sarvam.ai  |  Get key: https://dashboard.sarvam.ai
  sarvam: {
    apiKey: process.env.SARVAM_API_KEY || '',
    baseUrl: 'https://api.sarvam.ai',
    asrModel: 'saarika:v1',    // Hindi ASR model
    ttsModel: 'bulbul:v1',     // Hindi TTS model
    translateModel: 'mayura:v1', // Translation model
  },

  gcp: {
    credentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-credentials.json',
    projectId: process.env.GCP_PROJECT_ID || '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  redis: {
    url: process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379',
    token: process.env.UPSTASH_REDIS_TOKEN || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'complyos_verify_2024',
    apiUrl: 'https://graph.facebook.com/v18.0',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'alerts@complyos.in',
  },

  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY || '',
    apiUrl: 'https://www.fast2sms.com/dev/bulkV2',
  },

  // Trust layer: confidence gate threshold (per PDF)
  trustLayer: {
    confidenceGate: 0.80, // below this → 'please confirm'
    citationRequired: true,
  },

  // Subscription pricing (INR per PDF)
  pricing: {
    free: 0,
    growth: 249,
    pro: 649,
    ca_lite: 749,
    ca_pro: 1599,
    womenDiscount: {
      growth: 199,  // 20% off
      pro: 454,     // 30% off
    },
    freeUserCostCap: 8, // INR/month cap for free tier cost control
  },
};

export default config;
